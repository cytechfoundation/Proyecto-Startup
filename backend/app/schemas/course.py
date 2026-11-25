from pydantic import BaseModel, Field
from typing import List, Optional

class LessonBase(BaseModel):
    title: str
    content_markdown: Optional[str] = None
    order: int = 0
    target_file: Optional[str] = None

class LessonCreate(LessonBase):
    course_id: int

class LessonRead(LessonBase):
    id: int

    class Config:
        from_attributes = True

class CourseBase(BaseModel):
    title: str
    description: Optional[str] = None
    project_path: Optional[str] = None
    difficulty: Optional[str] = "Beginner"
    category: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class CourseRead(CourseBase):
    id: int
    lessons: List[LessonRead] = []

    class Config:
        from_attributes = True
