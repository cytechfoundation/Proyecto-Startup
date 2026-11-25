from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

# Tabla intermedia para inscripciones (estudiantes en cursos)
enrollments = Table(
    "enrollments",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("course_id", Integer, ForeignKey("courses.id"), primary_key=True),
)

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    project_path = Column(String(512), nullable=True)  # Ruta a la carpeta del proyecto externo
    difficulty = Column(String(50), default="Beginner")
    category = Column(String(100))
    
    lessons = relationship("Lesson", back_populates="course", cascade="all, delete-orphan")
    students = relationship("User", secondary=enrollments, back_populates="courses")

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content_markdown = Column(Text)  # Teoría interactiva
    order = Column(Integer, default=0)
    target_file = Column(String(512), nullable=True)  # Archivo específico del proyecto para esta lección
    
    course = relationship("Course", back_populates="lessons")
