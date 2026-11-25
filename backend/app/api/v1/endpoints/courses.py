from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.db.session import get_db
from backend.app.services.course_service import CourseService
from backend.app.schemas.course import CourseCreate, CourseRead, LessonCreate, LessonRead
from backend.app.core.deps import get_current_user
from backend.app.models.user import User

router = APIRouter()

# Helper para validar roles
def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos suficientes para realizar esta acción"
            )
        return current_user
    return role_checker

@router.get("/", response_model=List[CourseRead])
def list_courses(db: Session = Depends(get_db)):
    """Cualquier usuario autenticado puede ver la lista de cursos."""
    return CourseService.get_courses(db)

@router.get("/{course_id}", response_model=CourseRead)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = CourseService.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    return course

@router.post("/", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    course_data: CourseCreate, 
    db: Session = Depends(get_db), 
    _ = Depends(require_role(["admin"]))
):
    """Solo ADMIN puede crear cursos y asignar rutas de proyectos."""
    return CourseService.create_course(db, course_data)

@router.post("/lessons", response_model=LessonRead, status_code=status.HTTP_201_CREATED)
def add_lesson(
    lesson_data: LessonCreate, 
    db: Session = Depends(get_db), 
    _ = Depends(require_role(["admin", "editor"]))
):
    """ADMIN y EDITOR pueden agregar lecciones y teoría."""
    return CourseService.create_lesson(db, lesson_data)

@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int, 
    db: Session = Depends(get_db), 
    _ = Depends(require_role(["admin"]))
):
    """Solo ADMIN puede eliminar un curso completo."""
    if not CourseService.delete_course(db, course_id):
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    return None
