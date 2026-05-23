import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { coursesAPI } from "../../../api";
import { apiErrorMessage } from "./apiError";

const DEFAULT_FORM = {
  title: "",
  short_description: "",
  description: "",
  price: "0",
  is_free: "true",
  status: "draft",
  language: "English",
};

export default function CourseCreateForm({ onDone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState(null);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const create = useMutation({
    mutationFn: () =>
      coursesAPI.create({
        ...form,
        is_free: form.is_free === "true",
        price: parseFloat(form.price) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries(["admin-courses"]);
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err, "Failed to create course.")),
  });

  return (
    <div className="glass" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
      <h4 style={{ marginBottom: "1rem" }}>New Course</h4>
      {error && (
        <div className="alert alert-error" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input
            className="form-control"
            name="title"
            placeholder="e.g. Mastering Django"
            value={form.title}
            onChange={change}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Short Description</label>
          <input
            className="form-control"
            name="short_description"
            placeholder="A one-sentence summary"
            value={form.short_description}
            onChange={change}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Full Description</label>
          <textarea
            className="form-control"
            name="description"
            placeholder="Detailed course description..."
            rows={3}
            value={form.description}
            onChange={change}
          />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Pricing</label>
            <select className="form-control" name="is_free" value={form.is_free} onChange={change}>
              <option value="true">Free</option>
              <option value="false">Paid</option>
            </select>
          </div>
          {form.is_free === "false" && (
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Price (BDT)</label>
              <input
                className="form-control"
                name="price"
                type="number"
                value={form.price}
                onChange={change}
              />
            </div>
          )}
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Status</label>
            <select className="form-control" name="status" value={form.status} onChange={change}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button
            className="btn btn-primary"
            onClick={() => create.mutate()}
            disabled={!form.title || create.isPending}
          >
            {create.isPending ? "Creating..." : "Create Course"}
          </button>
          <button className="btn btn-outline" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
