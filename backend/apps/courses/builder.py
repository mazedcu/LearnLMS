"""
Course Builder API
------------------
Endpoints used by the teacher's Course Builder page:

  GET  /api/courses/<slug>/outline/   full outline incl. drafts, lock rules, counts
  POST /api/courses/<slug>/reorder/   save module + lesson order (lessons may move
                                      between modules) in one transaction
"""
from django.db import transaction
from django.db.models import Count, Max
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.access import is_course_staff
from apps.common.permissions import IsInstructorOrAdmin
from .models import Course, Module, Lesson


def _course_for_editor(request, slug):
    course = get_object_or_404(Course, slug=slug)
    user = request.user
    if not (is_course_staff(user, course) or getattr(user, 'role', '') == 'instructor'):
        raise PermissionDenied
    return course


def _drip(lesson):
    rule = getattr(lesson, 'drip_rule', None)
    if rule is None:
        return None
    return {
        'criteria_type': rule.criteria_type,
        'unlock_after_days': rule.unlock_after_days,
        'required_lesson': str(rule.required_lesson_id) if rule.required_lesson_id else None,
        'required_quiz': str(rule.required_quiz_id) if rule.required_quiz_id else None,
        'required_score': rule.required_score,
    }


class CourseOutlineView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def get(self, request, slug):
        course = _course_for_editor(request, slug)
        lessons = (
            Lesson.objects.filter(module__course=course)
            .select_related('drip_rule')
            .annotate(
                block_count=Count('content_blocks', distinct=True),
                quiz_count=Count('quizzes', distinct=True),
            )
            .order_by('order', 'created_at')
        )
        from apps.assessments.models import Quiz
        quizzes_by_lesson = {}
        for q in Quiz.objects.filter(lesson__module__course=course).order_by('created_at'):
            quizzes_by_lesson.setdefault(q.lesson_id, []).append({'id': str(q.id), 'title': q.title})

        by_module = {}
        for lesson in lessons:
            by_module.setdefault(lesson.module_id, []).append({
                'id': str(lesson.id),
                'title': lesson.title,
                'order': lesson.order,
                'is_published': lesson.is_published,
                'is_preview': lesson.is_preview,
                'estimated_duration_mins': lesson.estimated_duration_mins,
                'block_count': lesson.block_count,
                'quiz_count': lesson.quiz_count,
                'drip_rule': _drip(lesson),
                'quizzes': quizzes_by_lesson.get(lesson.id, []),
            })

        modules = [
            {
                'id': str(m.id),
                'title': m.title,
                'description': m.description,
                'order': m.order,
                'lessons': by_module.get(m.id, []),
            }
            for m in course.modules.order_by('order')
        ]
        return Response({
            'id': str(course.id),
            'slug': course.slug,
            'title': course.title,
            'status': course.status,
            'is_free': course.is_free,
            'price': str(course.price),
            'modules': modules,
        })


class CourseReorderView(APIView):
    """Body: {"modules": [{"id": <module>, "lessons": [<lesson>, ...]}, ...]}

    Module order follows the list; each module's lessons are renumbered from 1
    and moved into that module if they came from another one.
    """
    permission_classes = [IsInstructorOrAdmin]

    def post(self, request, slug):
        course = _course_for_editor(request, slug)
        payload = request.data.get('modules')
        if not isinstance(payload, list):
            raise ValidationError({'modules': 'Expected a list.'})

        modules = {str(m.id): m for m in course.modules.all()}
        lessons = {str(l.id): l for l in Lesson.objects.filter(module__course=course)}

        seen_modules, seen_lessons = [], set()
        for entry in payload:
            mid = str(entry.get('id', ''))
            if mid not in modules or mid in seen_modules:
                raise ValidationError({'modules': f'Unknown or repeated module {mid}.'})
            seen_modules.append(mid)
            for lid in entry.get('lessons') or []:
                lid = str(lid)
                if lid not in lessons or lid in seen_lessons:
                    raise ValidationError({'lessons': f'Unknown or repeated lesson {lid}.'})
                seen_lessons.add(lid)
        if set(seen_modules) != set(modules):
            raise ValidationError({'modules': 'Every module in the course must be listed.'})
        if seen_lessons != set(lessons):
            raise ValidationError({'lessons': 'Every lesson in the course must be listed.'})

        with transaction.atomic():
            # (course, order) is unique for modules, so park them out of the
            # way first, then write the final positions.
            offset = (course.modules.aggregate(m=Max('order'))['m'] or 0) + len(modules) + 1
            for i, mid in enumerate(seen_modules):
                Module.objects.filter(pk=mid).update(order=offset + i)
            for i, mid in enumerate(seen_modules, start=1):
                Module.objects.filter(pk=mid).update(order=i)

            for entry in payload:
                mid = str(entry['id'])
                for i, lid in enumerate(entry.get('lessons') or [], start=1):
                    Lesson.objects.filter(pk=lid).update(module_id=mid, order=i)

        return Response(status=status.HTTP_204_NO_CONTENT)


class CoursePublishLessonsView(APIView):
    """Publish every draft lesson in the course (or in one module).

    Body (optional): {"module": <module id>}
    """
    permission_classes = [IsInstructorOrAdmin]

    def post(self, request, slug):
        course = _course_for_editor(request, slug)
        lessons = Lesson.objects.filter(module__course=course, is_published=False)
        module_id = request.data.get('module')
        if module_id:
            lessons = lessons.filter(module_id=module_id)
        count = lessons.update(is_published=True)
        return Response({'published': count})


class CourseDuplicateView(APIView):
    """Copy a whole course (modules, topics, content, quizzes, unlock rules)
    into a new draft course. Students, enrollments, progress and quiz
    results are never copied.

    Body (optional): {"title": "New course name"}
    """
    permission_classes = [IsInstructorOrAdmin]

    @transaction.atomic
    def post(self, request, slug):
        from django.utils.text import slugify
        from apps.assessments.models import Quiz, Question
        from apps.content.models import ContentBlock
        from apps.dripping.models import DrippingRule

        src = _course_for_editor(request, slug)
        title = (request.data.get('title') or '').strip() or f'{src.title} (copy)'
        title = title[:255]

        base = slugify(title)[:240] or 'course'
        new_slug, n = base, 2
        while Course.objects.filter(slug=new_slug).exists():
            new_slug, n = f'{base}-{n}', n + 1

        course = Course.objects.create(
            title=title, slug=new_slug, description=src.description,
            short_description=src.short_description, thumbnail=src.thumbnail or None,
            instructor=src.instructor, price=src.price, is_free=src.is_free,
            status='draft', requirements=src.requirements, outcomes=src.outcomes,
            language=src.language,
        )

        lesson_map, quiz_map = {}, {}
        for m in src.modules.all():
            nm = Module.objects.create(course=course, title=m.title, description=m.description, order=m.order)
            for l in m.lessons.all():
                nl = Lesson.objects.create(
                    module=nm, title=l.title, order=l.order, is_published=l.is_published,
                    is_preview=l.is_preview, estimated_duration_mins=l.estimated_duration_mins,
                )
                lesson_map[l.id] = nl
                for b in l.content_blocks.all():
                    nb = ContentBlock(
                        lesson=nl, block_type=b.block_type, order=b.order, title=b.title,
                        html_content=b.html_content, is_fullscreen=b.is_fullscreen,
                        h5p_embed_url=b.h5p_embed_url, moodle_resource_id=b.moodle_resource_id,
                        video_url=b.video_url,
                    )
                    if b.file:
                        nb.file.name = b.file.name  # same stored file, no second copy on disk
                    nb.save()  # H5P packages are unpacked again for the new block
                for q in l.quizzes.all():
                    nq = Quiz.objects.create(
                        lesson=nl, title=q.title, description=q.description,
                        time_limit_mins=q.time_limit_mins, passing_score=q.passing_score,
                        max_attempts=q.max_attempts, is_active=q.is_active,
                    )
                    quiz_map[q.id] = nq
                    Question.objects.bulk_create([
                        Question(quiz=nq, question_type=x.question_type, prompt=x.prompt,
                                 content=x.content, max_marks=x.max_marks, order=x.order,
                                 is_active=x.is_active)
                        for x in q.questions.all()
                    ])

        for rule in DrippingRule.objects.filter(lesson__in=lesson_map.keys()):
            DrippingRule.objects.create(
                lesson=lesson_map[rule.lesson_id], criteria_type=rule.criteria_type,
                unlock_after_days=rule.unlock_after_days,
                required_lesson=lesson_map.get(rule.required_lesson_id),
                required_score=rule.required_score,
                required_quiz=quiz_map.get(rule.required_quiz_id),
                is_globally_locked=rule.is_globally_locked,
            )

        return Response({'slug': course.slug, 'title': course.title,
                         'modules': src.modules.count(), 'topics': len(lesson_map)},
                        status=status.HTTP_201_CREATED)
