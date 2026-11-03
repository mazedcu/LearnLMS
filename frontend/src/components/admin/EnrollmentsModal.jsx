import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Search, UserPlus, X } from "lucide-react";
import { staffEnrollAPI } from "../../api";

function errorText(e, fallback) {
  const d = e?.response?.data;
  if (!d) return fallback;
  return d.detail || Object.values(d).flat().join(" ") || fallback;
}

const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Admin / manager: see a student's courses, admit them to more, remove or restore access. */
export default function EnrollmentsModal({ student, onClose }) {
  const qc = useQueryClient();
  const key = ["staff-enrollments", student.id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => staffEnrollAPI.forStudent(student.id).then((r) => r.data),
  });
  const [picked, setPicked] = useState([]);
  const [until, setUntil] = useState("");
  const [find, setFind] = useState("");
  const [notice, setNotice] = useState(null);

  const done = (text) => (r) => {
    qc.setQueryData(key, r.data);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    setNotice({ kind: "success", text: typeof text === "function" ? text(r.data) : text });
  };
  const fail = (fallback) => (e) => setNotice({ kind: "error", text: errorText(e, fallback) });

  const admit = useMutation({
    mutationFn: () => staffEnrollAPI.admit(student.id, picked, until),
    onSuccess: (r) => {
      done((d) => `Admitted to ${d.admitted.join(", ")}.`)(r);
      setPicked([]);
    },
    onError: fail("Couldn't admit the student."),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }) => staffEnrollAPI.update(id, body),
    onSuccess: (r, v) => done(v.is_active === false ? "Access removed." : "Access restored.")(r),
    onError: fail("Couldn't change the enrollment."),
  });

  const enrolledIds = new Set((data?.enrollments || []).map((e) => e.course));
  const available = useMemo(
    () => (data?.courses || []).filter((c) => !enrolledIds.has(c.id) && c.title.toLowerCase().includes(find.toLowerCase())),
    [data, find] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="enr-backdrop" onClick={onClose}>
      <div className="enr-modal" role="dialog" aria-modal="true" aria-label={`Courses for ${student.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="enr-head">
          <div>
            <h3>Courses for {data?.student.name || student.name}</h3>
            <p className="text-muted">{data?.student.email || student.email}</p>
          </div>
          <button type="button" className="enr-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="enr-body">
          {notice && <div className={`alert ${notice.kind === "error" ? "alert-error" : "alert-success"}`} style={{ marginBottom: "1rem" }}>{notice.text}</div>}
          {isLoading && <div className="spinner" style={{ margin: "2rem auto" }} />}
          {error && <div className="alert alert-error">{errorText(error, "Couldn't load this student's courses.")}</div>}

          {data && (
            <>
              <h4 className="enr-h">Enrolled ({data.enrollments.filter((e) => e.is_active && !e.expired).length})</h4>
              {data.enrollments.length === 0 ? (
                <p className="enr-empty">Not enrolled in any course yet.</p>
              ) : (
                <ul className="enr-list">
                  {data.enrollments.map((e) => {
                    const live = e.is_active && !e.expired;
                    return (
                      <li key={e.id} className={live ? "" : "off"}>
                        <BookOpen size={16} className="enr-ic" />
                        <div className="enr-main">
                          <b>{e.course_title}</b>
                          <span>
                            {!e.is_active ? "Access removed" : e.expired ? `Ended ${fmt(e.expiry_date)}` : e.expiry_date ? `Until ${fmt(e.expiry_date)}` : "No end date"}
                            {" · since "}{fmt(e.enrolled_at)}
                          </span>
                        </div>
                        {live ? (
                          <button type="button" className="btn btn-outline btn-sm" disabled={update.isPending}
                            onClick={() => { if (confirm(`Remove ${data.student.name}'s access to ${e.course_title}? Their progress is kept.`)) update.mutate({ id: e.id, is_active: false }); }}>
                            Remove
                          </button>
                        ) : (
                          <button type="button" className="btn btn-primary btn-sm" disabled={update.isPending}
                            onClick={() => update.mutate({ id: e.id, is_active: true, ...(e.expired ? { expiry_date: null } : {}) })}>
                            Restore
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <h4 className="enr-h" style={{ marginTop: "1.5rem" }}>Admit to more courses</h4>
              {data.courses.length > enrolledIds.size ? (
                <>
                  {data.courses.length - enrolledIds.size > 6 && (
                    <div style={{ position: "relative", marginBottom: "0.6rem" }}>
                      <Search size={14} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--clr-muted)" }} />
                      <input className="form-control" style={{ paddingLeft: "2.1rem" }} placeholder="Find a course…" value={find} onChange={(e) => setFind(e.target.value)} />
                    </div>
                  )}
                  <div className="enr-pick">
                    {available.map((c) => (
                      <label key={c.id} className={picked.includes(c.id) ? "on" : ""}>
                        <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                        <span className="enr-check">{picked.includes(c.id) && <Check size={13} />}</span>
                        <span className="enr-main">
                          <b>{c.title}</b>
                          <span>{c.is_free ? "Free" : `BDT ${Number(c.price).toLocaleString()}`}{c.status !== "published" && " · draft course"}</span>
                        </span>
                      </label>
                    ))}
                    {available.length === 0 && <p className="enr-empty">No course matches “{find}”.</p>}
                  </div>
                  <div className="enr-foot">
                    <label className="enr-until">
                      <span>Access until <span className="text-muted" style={{ fontWeight: 500 }}>(optional)</span></span>
                      <input type="date" className="form-control" value={until} onChange={(e) => setUntil(e.target.value)} />
                    </label>
                    <button type="button" className="btn btn-primary" disabled={!picked.length || admit.isPending} onClick={() => admit.mutate()}>
                      <UserPlus size={15} /> {admit.isPending ? "Admitting…" : picked.length ? `Admit to ${picked.length} course${picked.length > 1 ? "s" : ""}` : "Choose courses"}
                    </button>
                  </div>
                  <p className="enr-hint">No payment needed — the student can open the course straight away. Leave the date empty for lifetime access.</p>
                </>
              ) : (
                <p className="enr-empty">Already enrolled in every course.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
