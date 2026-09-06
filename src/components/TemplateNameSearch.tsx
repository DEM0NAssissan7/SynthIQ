import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { Button, Form } from "react-bootstrap";
import { getFullPrettyDate } from "../lib/timing";
import type { Template } from "../models/types/interfaces";
import { EmptyState } from "./PageLayout";

export default function TemplateNameSearch({
  onInput,
  onDelete,
  templates,
}: {
  onInput: (name: string) => void;
  onDelete: (name: string) => void;
  templates: Template[];
}) {
  const [query, setQuery] = useState("");

  const filteredTemplates: Template[] = useMemo(() => {
    let result: Template[] = [];
    for (let n of templates) {
      if (n.name === "Session") continue; // Reserved template name for the Skip button
      if (n.name.toLowerCase().includes(query.trim().toLowerCase())) {
        result.push(n);
      }
    }

    // Sort by timestamp, most recent first
    result.sort((a, b) => {
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return result;
  }, [query, templates]);

  function deleteTemplate(e: React.MouseEvent, name: string) {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this template?")) {
      if (
        confirm(
          "This action is irreversible and all associated template data will be permanently removed."
        )
      ) {
        onDelete(name);
        location.reload();
      }
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="app-card-title mb-0">
          <i className="bi bi-collection text-primary" />
          <span>Meal Templates</span>
        </div>
        <span
          className="badge bg-primary-subtle text-primary fw-semibold px-2 py-0.5 rounded-pill"
          style={{ fontSize: "0.72rem" }}
        >
          {filteredTemplates.length}{" "}
          {filteredTemplates.length === 1 ? "template" : "templates"}
        </span>
      </div>

      <Form onSubmit={(e: BaseSyntheticEvent) => e.preventDefault()}>
        <div className="input-group mb-2">
          <span className="input-group-text bg-body-tertiary border-end-0 text-muted">
            <i className="bi bi-search" />
          </span>
          <Form.Control
            type="search"
            placeholder="Search templates..."
            className="border-start-0 ps-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.length > 0 && (
            <Button
              variant="outline-secondary"
              className="border-start-0 d-flex align-items-center justify-content-center text-muted"
              style={{ width: "2.5rem" }}
              onClick={() => setQuery("")}
              title="Clear search"
            >
              <i className="bi bi-x-lg" style={{ fontSize: "0.8rem" }} />
            </Button>
          )}
        </div>
      </Form>

      {filteredTemplates.length === 0 ? (
        <EmptyState>
          {query.trim().length > 0
            ? `No templates matching "${query}".`
            : "No templates saved yet."}
        </EmptyState>
      ) : (
        <div className="app-template-list">
          {filteredTemplates.map((template: Template, i: number) => (
            <div
              key={i}
              className="app-template-row"
              onClick={() => onInput(template.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onInput(template.name);
                }
              }}
            >
              <div className="template-main">
                <div className="template-name">{template.name}</div>
                <div className="template-meta">
                  <span className="fw-medium text-body-secondary">
                    {template.size} {template.size === 1 ? "session" : "sessions"}
                  </span>
                  <span>·</span>
                  <span>{getFullPrettyDate(template.timestamp)}</span>
                  {template.score > 0 && (
                    <>
                      <span>·</span>
                      <span className="badge bg-body-tertiary border text-muted fw-semibold rounded-pill px-1.5 py-0.5">
                        Score {template.score.toFixed(0)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="template-actions">
                <button
                  type="button"
                  className="template-del-btn"
                  onClick={(e) => deleteTemplate(e, template.name)}
                  title="Delete template"
                  aria-label={`Delete ${template.name}`}
                >
                  <i className="bi bi-trash3" />
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-semibold d-flex align-items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInput(template.name);
                  }}
                >
                  <span>Use</span>
                  <i className="bi bi-chevron-right" style={{ fontSize: "0.75rem" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
