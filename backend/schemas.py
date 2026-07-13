"""Sentinel AI - Pydantic models."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: Literal["admin", "operator", "viewer"] = "viewer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CameraIn(BaseModel):
    name: str
    location: str = ""
    source_type: Literal["webcam", "rtsp", "image", "demo"] = "demo"
    stream_url: Optional[str] = None
    scene: Literal["warehouse", "traffic", "factory", "webcam"] = "warehouse"
    enabled: bool = True
    thumbnail_url: Optional[str] = None


class CameraPatch(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    stream_url: Optional[str] = None
    scene: Optional[str] = None
    enabled: Optional[bool] = None
    thumbnail_url: Optional[str] = None


class SettingsIn(BaseModel):
    confidence_threshold: float = Field(0.35, ge=0.05, le=0.95)
    iou_threshold: float = Field(0.45, ge=0.1, le=0.95)
    detection_classes: List[str] = Field(default_factory=lambda: ["person", "car", "motorcycle", "truck", "bicycle", "bus"])
    max_people_threshold: int = Field(10, ge=1, le=500)
    alarm_volume: int = Field(70, ge=0, le=100)
    processing_resolution: Literal["480p", "720p", "1080p"] = "720p"
    frame_skip: int = Field(2, ge=0, le=10)
    abandoned_object_seconds: int = Field(30, ge=5, le=600)


class EventCreate(BaseModel):
    camera_id: Optional[str] = None
    camera_name: str
    detection_type: str
    confidence: float
    severity: Literal["info", "warning", "critical"] = "info"
    snapshot: Optional[str] = None  # base64 or url
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UserPatch(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin", "operator", "viewer"]] = None
    password: Optional[str] = None
