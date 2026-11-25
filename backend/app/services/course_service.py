from sqlalchemy.orm import Session
from backend.app.models.course import Course, Lesson
from backend.app.schemas.course import CourseCreate, LessonCreate

class CourseService:
    @staticmethod
    def get_courses(db: Session):
        return db.query(Course).all()

    @staticmethod
    def get_course_by_id(db: Session, course_id: int):
        return db.query(Course).filter(Course.id == course_id).first()

    @staticmethod
    def create_course(db: Session, course_data: CourseCreate):
        db_course = Course(**course_data.model_dump())
        db.add(db_course)
        db.commit()
        db.refresh(db_course)
        return db_course

    @staticmethod
    def create_lesson(db: Session, lesson_data: LessonCreate):
        db_lesson = Lesson(**lesson_data.model_dump())
        db.add(db_lesson)
        db.commit()
        db.refresh(db_lesson)
        return db_lesson

    @staticmethod
    def delete_course(db: Session, course_id: int):
        course = db.query(Course).filter(Course.id == course_id).first()
        if course:
            db.delete(course)
            db.commit()
            return True
        return False
