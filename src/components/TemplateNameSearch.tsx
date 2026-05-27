import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { Button, Form, ListGroup } from "react-bootstrap";
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
  }, [query]);

  // Just to prevent reload when pressing enter
  const handleFormSubmit = (e: BaseSyntheticEvent) => {
    e.preventDefault(); // Prevent the default form submission behavior
  };

  function deleteTemplate(name: string) {
    if (confirm("Are you SURE you want to delete this template?")) {
      if (
        confirm(
          "This action will be irreversable, and all associated data with the template WILL be permanently destroyed."
        )
      ) {
        onDelete(name);
        location.reload();
      }
    }
  }

  return (
    <>
      <Form>
        <Form.Group controlId="food-search" className="mb-3">
          <Form.Label>Template Search</Form.Label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <Form.Control
              type="text"
              placeholder="Search templates..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </Form.Group>
      </Form>

      <ListGroup variant="flush">
        {filteredTemplates.map((template: Template, i: number) => (
          <ListGroup.Item key={i} className="px-0 py-3 border-0 border-bottom">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <div className="fw-semibold">{template.name}</div>
                <div className="text-muted small">{template.size} sessions</div>
              </div>
              <div className="text-end small text-muted">
                <div>{getFullPrettyDate(template.timestamp)}</div>
                <div>Score {template.score.toFixed(0)}</div>
              </div>
            </div>
            <Form onSubmit={handleFormSubmit}>
              <div className="d-grid gap-2 d-sm-flex justify-content-sm-end">
                <Button
                  variant="outline-danger"
                  onClick={() => deleteTemplate(template.name)}
                >
                  Delete
                </Button>
                <Button
                  variant="primary"
                  onClick={() => onInput(template.name)}
                >
                  Use
                </Button>
              </div>
            </Form>
          </ListGroup.Item>
        ))}

        {filteredTemplates.length === 0 && query.length !== 0 && (
          <ListGroup.Item className="px-0 border-0">
            <EmptyState>No templates match that search.</EmptyState>
          </ListGroup.Item>
        )}
      </ListGroup>
    </>
  );
}
