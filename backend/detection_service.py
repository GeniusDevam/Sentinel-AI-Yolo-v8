"""Sentinel AI - Detection service using YOLOv8n.

Runs YOLO inference on uploaded images and video frames. Also provides
simulated bounding boxes for the live webcam stream (client-side canvas
overlay preview).
"""
import os
import io
import time
import base64
import random
from typing import List, Dict, Any

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

# Only these detection classes are relevant (COCO ids)
CLASS_MAP = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

_MODEL: YOLO | None = None


def get_model() -> YOLO:
    global _MODEL
    if _MODEL is None:
        model_name = os.environ.get("YOLO_MODEL", "yolov8n.pt")
        _MODEL = YOLO(model_name)
    return _MODEL


def _detect_fire_smoke(bgr: np.ndarray) -> List[Dict[str, Any]]:
    """Color-heuristic fire/smoke detection. Returns extra detections."""
    dets: List[Dict[str, Any]] = []
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, w = bgr.shape[:2]

    # Fire: bright orange-red-yellow, high value
    fire_mask = cv2.inRange(hsv, (0, 120, 200), (25, 255, 255))
    fire_mask |= cv2.inRange(hsv, (160, 120, 200), (179, 255, 255))
    contours, _ = cv2.findContours(fire_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in contours:
        area = cv2.contourArea(c)
        if area < (w * h) * 0.005:
            continue
        x, y, cw, ch = cv2.boundingRect(c)
        dets.append({
            "class_name": "fire",
            "confidence": min(0.95, 0.6 + area / (w * h)),
            "bbox": [int(x), int(y), int(x + cw), int(y + ch)],
        })

    # Smoke: grayish, low saturation, mid-high value, upper part of frame
    smoke_mask = cv2.inRange(hsv, (0, 0, 130), (179, 40, 220))
    contours, _ = cv2.findContours(smoke_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in contours:
        area = cv2.contourArea(c)
        if area < (w * h) * 0.03:
            continue
        x, y, cw, ch = cv2.boundingRect(c)
        if y > h * 0.6:  # smoke rises, ignore ground-level gray
            continue
        dets.append({
            "class_name": "smoke",
            "confidence": min(0.9, 0.55 + area / (w * h)),
            "bbox": [int(x), int(y), int(x + cw), int(y + ch)],
        })
    return dets[:5]


def run_detection_on_image(image_bytes: bytes, conf: float = 0.35, iou: float = 0.45) -> Dict[str, Any]:
    """Run YOLO on raw image bytes. Returns detections + annotated image (base64)."""
    start = time.time()
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image")

    model = get_model()
    results = model.predict(bgr, conf=conf, iou=iou, verbose=False)

    detections: List[Dict[str, Any]] = []
    for r in results:
        if r.boxes is None:
            continue
        for i in range(len(r.boxes)):
            cls_id = int(r.boxes.cls[i].item())
            if cls_id not in CLASS_MAP:
                continue
            xyxy = r.boxes.xyxy[i].tolist()
            detections.append({
                "class_name": CLASS_MAP[cls_id],
                "confidence": float(r.boxes.conf[i].item()),
                "bbox": [int(v) for v in xyxy],
            })

    detections.extend(_detect_fire_smoke(bgr))

    annotated = _annotate(bgr.copy(), detections)
    ok, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
    annotated_b64 = base64.b64encode(buf.tobytes()).decode("ascii") if ok else None

    counts = _count_by_class(detections)
    inference_ms = int((time.time() - start) * 1000)
    return {
        "detections": detections,
        "counts": counts,
        "inference_ms": inference_ms,
        "image_width": bgr.shape[1],
        "image_height": bgr.shape[0],
        "annotated_image": annotated_b64,
    }


def run_detection_on_video(video_bytes: bytes, conf: float = 0.35, iou: float = 0.45, max_frames: int = 24) -> Dict[str, Any]:
    """Sample frames from an uploaded video and aggregate detections."""
    tmp_path = f"/tmp/vid_{int(time.time()*1000)}.mp4"
    with open(tmp_path, "wb") as f:
        f.write(video_bytes)
    cap = cv2.VideoCapture(tmp_path)
    if not cap.isOpened():
        os.remove(tmp_path)
        raise ValueError("Could not open video")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    step = max(1, total // max_frames) if total else 5

    model = get_model()
    frames_out = []
    agg_counts: Dict[str, int] = {}
    total_inf = 0.0
    idx = 0
    frame_no = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % step != 0:
            idx += 1
            continue
        idx += 1
        frame_no += 1
        if frame_no > max_frames:
            break
        t0 = time.time()
        results = model.predict(frame, conf=conf, iou=iou, verbose=False)
        dets = []
        for r in results:
            if r.boxes is None:
                continue
            for i in range(len(r.boxes)):
                cls_id = int(r.boxes.cls[i].item())
                if cls_id not in CLASS_MAP:
                    continue
                xyxy = r.boxes.xyxy[i].tolist()
                dets.append({
                    "class_name": CLASS_MAP[cls_id],
                    "confidence": float(r.boxes.conf[i].item()),
                    "bbox": [int(v) for v in xyxy],
                })
        dets.extend(_detect_fire_smoke(frame))
        total_inf += (time.time() - t0)
        counts = _count_by_class(dets)
        for k, v in counts.items():
            agg_counts[k] = max(agg_counts.get(k, 0), v)

        annotated = _annotate(frame.copy(), dets)
        # downscale to keep response small
        h_, w_ = annotated.shape[:2]
        scale = 640 / max(w_, 1)
        if scale < 1:
            annotated = cv2.resize(annotated, (int(w_ * scale), int(h_ * scale)))
        ok, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        frames_out.append({
            "frame_index": idx,
            "detections": dets,
            "counts": counts,
            "image": base64.b64encode(buf.tobytes()).decode("ascii") if ok else None,
        })

    cap.release()
    os.remove(tmp_path)

    avg_ms = int((total_inf / max(frame_no, 1)) * 1000)
    return {
        "frames": frames_out,
        "total_counts": agg_counts,
        "avg_inference_ms": avg_ms,
        "sampled_frames": frame_no,
        "source_fps": round(fps, 1),
    }


def _annotate(bgr: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
    color_map = {
        "person": (37, 99, 235),  # blue
        "car": (16, 185, 129),
        "motorcycle": (245, 158, 11),
        "truck": (16, 185, 129),
        "bicycle": (245, 158, 11),
        "bus": (16, 185, 129),
        "fire": (0, 0, 239),
        "smoke": (200, 200, 200),
    }
    for d in detections:
        x1, y1, x2, y2 = d["bbox"]
        color = color_map.get(d["class_name"], (37, 99, 235))
        cv2.rectangle(bgr, (x1, y1), (x2, y2), color, 2)
        label = f"{d['class_name']} {d['confidence']:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(bgr, (x1, y1 - th - 6), (x1 + tw + 6, y1), color, -1)
        cv2.putText(bgr, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    return bgr


def _count_by_class(detections: List[Dict[str, Any]]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for d in detections:
        counts[d["class_name"]] = counts.get(d["class_name"], 0) + 1
    return counts


# ------- Simulated live-feed detections -------
def simulate_frame_detections(width: int = 1280, height: int = 720, scene: str = "warehouse") -> Dict[str, Any]:
    """Generate realistic random bboxes for a demo live stream."""
    rng = random
    classes_by_scene = {
        "warehouse": ["person", "person", "truck", "person"],
        "traffic": ["car", "car", "motorcycle", "bus", "person", "car"],
        "factory": ["person", "person", "person"],
        "webcam": ["person"],
    }
    pool = classes_by_scene.get(scene, ["person", "car"])
    dets = []
    n = rng.randint(1, min(6, len(pool)))
    for _ in range(n):
        cls = rng.choice(pool)
        bw = rng.randint(int(width * 0.06), int(width * 0.22))
        bh = rng.randint(int(height * 0.18), int(height * 0.55)) if cls == "person" else rng.randint(int(height * 0.12), int(height * 0.35))
        x1 = rng.randint(0, max(1, width - bw))
        y1 = rng.randint(int(height * 0.15), max(int(height * 0.15) + 1, height - bh))
        dets.append({
            "class_name": cls,
            "confidence": round(rng.uniform(0.62, 0.96), 2),
            "bbox": [x1, y1, x1 + bw, y1 + bh],
        })
    return {"detections": dets, "counts": _count_by_class(dets), "inference_ms": rng.randint(18, 42)}
