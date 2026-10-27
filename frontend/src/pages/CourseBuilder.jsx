import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Settings, PanelLeft, BookOpen, FolderPlus } from "lucide-react";
import { adminAPI, builderAPI, coursesAPI } from "../api";
import OutlinePanel from "../components/builder/OutlinePanel";
import LessonPanel from "../components/builder/LessonPanel";
import CourseSettingsDrawer from "../components/builder/CourseSettings";
import { useToast, apiErrorMessage } from "../components/builder/shared";
import "../components/builder/builder.css";

export default function CourseBuilder() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [toast, toastNode] = useToast();
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const outlineKey = ["builder-outline", slug];
  const { data: course, isLoading, isFetching, error } = useQuery({
    queryKey: outlineKey,
    queryFn: () => builderAPI.outline(slug).then((r) => r.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: outlineKey });
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
    qc.invalidateQueries({ queryKey: ["course-learn", slug] });
  };
  const fail = (msg) => (e) => toast(apiErrorMessage(e, msg), "error");

  const modules = course?.modules || [];
  const allLessons = useMemo(
    () => modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title }))),
    [modules]
  );
  const activeLesson = allLessons.find((l) => l.id === lessonId) || null;

  // Open the first lesson when none is chosen (or the chosen one was deleted)
  useEffect(() => {
    if (!course || isFetching) return; // wait for a refresh before deciding the lesson is gone
    if (!activeLesson && allLessons.length) {
      navigate(`/dashboard/admin/courses/${slug}/${allLessons[0].id}`, { replace: true });
    }
  }, [course, isFetching, activeLesson, allLessons, slug, navigate]);

  const selectLesson = (id) => {
    navigate(`/dashboard/admin/courses/${slug}/${id}`);
    setOutlineOpen(false);
  };

  // ── Mutations ──
  const reorder = useMutation({
    mutationFn: (structure) => builderAPI.reorder(slug, structure),
    onMutate: async (structure) => {
      // Show the new order immediately
      await qc.cancelQueries({ queryKey: outlineKey });
      const prev = qc.getQueryData(outlineKey);
      if (prev) {
        const lessonsById = Object.fromEntries(prev.modules.flatMap((m) => m.lessons).map((l) => [l.id, l]));
        const modsById = Object.fromEntries(prev.modules.map((m) => [m.id, m]));
        qc.setQueryData(outlineKey, {
          ...prev,
          modules: structure.map((s) => ({ ...modsById[s.id], lessons: s.lessons.map((id) => lessonsById[id]) })),
        });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(outlineKey, ctx.prev); fail("Couldn't save the new order.")(e); },
    onSettled: refresh,
  });

  const addModule = useMutation({
    mutationFn: (title) => adminAPI.createModule(slug, { title }),
    onSuccess: () => { refresh(); toast("Module added"); },
    onError: fail("Couldn't add the module."),
  });
  const renameModule = useMutation({
    mutationFn: ({ id, title }) => adminAPI.updateModule(id, { title }),
    onSuccess: refresh, onError: fail("Couldn't rename the module."),
  });
  const deleteModule = useMutation({
    mutationFn: (id) => adminAPI.deleteModule(id),
    onSuccess: () => { refresh(); toast("Module deleted"); }, onError: fail("Couldn't delete the module."),
  });
  const addLesson = useMutation({
    mutationFn: ({ moduleId, title }) => adminAPI.createLesson(moduleId, { title, is_published: false }),
    onSuccess: async (res) => {
      await qc.refetchQueries({ queryKey: outlineKey });
      refresh();
      if (res?.data?.id) selectLesson(res.data.id);
      toast("Lesson added as a draft");
    },
    onError: fail("Couldn't add the lesson."),
  });
  const renameLesson = useMutation({
    mutationFn: ({ id, title }) => adminAPI.updateLesson(id, { title }),
    onSuccess: refresh, onError: fail("Couldn't rename the lesson."),
  });
  const deleteLesson = useMutation({
    mutationFn: (id) => adminAPI.deleteLesson(id),
    onSuccess: () => { refresh(); toast("Lesson deleted"); }, onError: fail("Couldn't delete the lesson."),
  });
  const togglePublish = useMutation({
    mutationFn: () => coursesAPI.update(slug, { status: course.status === "published" ? "draft" : "published" }),
    onSuccess: () => { refresh(); toast(course.status === "published" ? "Course unpublished" : "Course published"); },
    onError: fail("Couldn't change the course status."),
  });

  const publishLessons = useMutation({
    mutationFn: () => builderAPI.publishLessons(slug),
    onSuccess: (r) => { refresh(); toast(`${r.data.published} lesson${r.data.published === 1 ? "" : "s"} published — students can see them now`); },
    onError: fail("Couldn't publish the lessons."),
  });

  const confirmDeleteModule = (mod) => {
    const n = mod.lessons.length;
    if (confirm(`Delete module "${mod.title}"${n ? ` and its ${n} lesson${n > 1 ? "s" : ""}` : ""}? This can't be undone.`)) deleteModule.mutate(mod.id);
  };
  const confirmDeleteLesson = (lesson) => {
    if (confirm(`Delete lesson "${lesson.title}" and all its content? This can't be undone.`)) deleteLesson.mutate(lesson.id);
  };

  if (error) {
    return (
      <div className="cb-empty" style={{ paddingTop: "8rem" }}>
        <h3>Couldn't open this course</h3>
        <p>{error.response?.status === 403 ? "You don't have permission to edit it." : "It may have been deleted."}</p>
        <button className="cb-btn" onClick={() => navigate("/dashboard/admin")}>Back to dashboard</button>
      </div>
    );
  }

  const isLive = course?.status === "published";
  const draftLessons = allLessons.filter((l) => !l.is_published);
  const hiddenModules = modules.filter((m) => m.lessons.length && m.lessons.every((l) => !l.is_published));

  return (
    <div className={`cb-shell${outlineOpen ? " outline-open" : ""}`}>
      <header className="cb-top">
        <button className="cb-top-back" onClick={() => navigate("/dashboard/admin", { state: { section: "courses" } })}>
          <ArrowLeft size={16} /> <span>Courses</span>
        </button>
        <button className="cb-icon-btn cb-outline-toggle" aria-label="Show outline" onClick={() => setOutlineOpen((o) => !o)}>
          <PanelLeft size={18} />
        </button>
        <div className="cb-top-title">{course?.title || "Loading…"}</div>
        <div className="cb-top-actions">
          {course && (
            <button className={`cb-status${isLive ? " is-live" : ""}`} onClick={() => togglePublish.mutate()} disabled={togglePublish.isPending}
              title={isLive ? "Visible to students — click to unpublish" : "Hidden from students — click to publish"}>
              <span className="cb-status-dot" /> {isLive ? "Published" : "Draft"}
            </button>
          )}
          <a className="cb-btn cb-hide-sm" href={`/learn/${slug}`} target="_blank" rel="noopener noreferrer">
            <Eye size={15} /> <span className="cb-label">Preview</span>
          </a>
          <button className="cb-btn" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} /> <span className="cb-label">Settings</span>
          </button>
        </div>
      </header>

      {course && (!isLive || draftLessons.length > 0) && (
        <div className="cb-visibility" role="status">
          <EyeOff size={16} style={{ flexShrink: 0 }} />
          {!isLive ? (
            <span><b>Students can't see this course</b> — it's a draft.</span>
          ) : (
            <span>
              <b>{draftLessons.length} lesson{draftLessons.length === 1 ? " is a draft" : "s are drafts"}</b>, so students can't see {draftLessons.length === 1 ? "it" : "them"}
              {hiddenModules.length > 0 && <> — {hiddenModules.length === modules.length ? "every module looks empty to them" : `${hiddenModules.map((m) => `“${m.title}”`).join(", ")} look${hiddenModules.length === 1 ? "s" : ""} empty to them`}</>}.
            </span>
          )}
          {!isLive ? (
            <button className="cb-btn cb-btn-primary" onClick={() => togglePublish.mutate()} disabled={togglePublish.isPending}>Publish course</button>
          ) : (
            <button className="cb-btn cb-btn-primary" onClick={() => publishLessons.mutate()} disabled={publishLessons.isPending}>
              {publishLessons.isPending ? "Publishing…" : `Publish ${draftLessons.length === 1 ? "it" : `all ${draftLessons.length}`}`}
            </button>
          )}
        </div>
      )}

      {outlineOpen && <div className="cb-outline-backdrop" onClick={() => setOutlineOpen(false)} />}
      <nav className="cb-outline" aria-label="Course outline">
        {isLoading ? <div className="spinner" style={{ margin: "2rem auto" }} /> : (
          <OutlinePanel
            modules={modules}
            activeLessonId={activeLesson?.id}
            onSelectLesson={selectLesson}
            onReorder={(s) => reorder.mutate(s)}
            onAddModule={(title) => addModule.mutate(title)}
            onRenameModule={(id, title) => renameModule.mutate({ id, title })}
            onDeleteModule={confirmDeleteModule}
            onAddLesson={(moduleId, title) => addLesson.mutate({ moduleId, title })}
            onRenameLesson={(id, title) => renameLesson.mutate({ id, title })}
            onDeleteLesson={confirmDeleteLesson}
          />
        )}
      </nav>

      <main className="cb-main">
        {isLoading && <div className="spinner" style={{ margin: "4rem auto" }} />}

        {!isLoading && activeLesson && (
          <LessonPanel
            key={activeLesson.id}
            lesson={activeLesson}
            moduleTitle={activeLesson.moduleTitle}
            allLessons={allLessons}
            slug={slug}
            toast={toast}
            onLessonChanged={refresh}
            onDeleteLesson={() => confirmDeleteLesson(activeLesson)}
          />
        )}

        {!isLoading && !activeLesson && (
          <div className="cb-empty">
            {modules.length === 0 ? (
              <>
                <BookOpen size={40} color="var(--clr-primary)" style={{ margin: "0 auto" }} />
                <h3>Let's build this course</h3>
                <p>Courses are made of modules (chapters or units), and each module holds lessons. Start with your first module.</p>
                <button className="cb-btn cb-btn-primary" onClick={() => addModule.mutate("Module 1")}>
                  <FolderPlus size={15} /> Add first module
                </button>
              </>
            ) : (
              <>
                <BookOpen size={40} color="var(--clr-primary)" style={{ margin: "0 auto" }} />
                <h3>Add a lesson</h3>
                <p>Use "Add lesson" under a module in the outline, then drop your HTML files, videos, PDFs and quizzes into it.</p>
                <button className="cb-btn cb-btn-primary" onClick={() => addLesson.mutate({ moduleId: modules[0].id, title: "Lesson 1" })}>
                  Add a lesson to "{modules[0].title}"
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {settingsOpen && <CourseSettingsDrawer slug={slug} onClose={() => { setSettingsOpen(false); refresh(); }} />}
      {toastNode}
    </div>
  );
}
