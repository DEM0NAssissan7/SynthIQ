import { useState, useEffect, useRef } from "react";
import { Navbar, Container, Nav } from "react-bootstrap";
import { Link } from "react-router";

function TopBar() {
  const [expanded, setExpanded] = useState(false);
  const topBarRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => setExpanded(!expanded);
  const handleClose = () => setExpanded(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        topBarRef.current &&
        !topBarRef.current.contains(event.target as Node)
      ) {
        setExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={topBarRef}>
      <Navbar expand="lg" className="bg-body-tertiary" expanded={expanded}>
        <Container>
          <Navbar.Brand as={Link} to="/hub">
            <img
              src="/favicon.png"
              alt="Logo"
              width="30"
              height="30"
              className="d-inline-block align-top me-2"
            />
            SynthIQ
          </Navbar.Brand>
          <Navbar.Toggle
            aria-controls="basic-navbar-nav"
            onClick={handleToggle}
          />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/wizard" onClick={handleClose}>
                Wizard
              </Nav.Link>
              <Nav.Link as={Link} to="/basal" onClick={handleClose}>
                Basal Injection
              </Nav.Link>
              <Nav.Link as={Link} to="/customfoods" onClick={handleClose}>
                Custom Foods
              </Nav.Link>
              <Nav.Link as={Link} to="/profiler" onClick={handleClose}>
                Profiler
              </Nav.Link>
              <Nav.Link as={Link} to="/playground" onClick={handleClose}>
                Playground
              </Nav.Link>
              <Nav.Link as={Link} to="/statistics" onClick={handleClose}>
                Statistics
              </Nav.Link>
              <Nav.Link as={Link} to="/dextrose" onClick={handleClose}>
                Dextrose
              </Nav.Link>
              <Nav.Link as={Link} to="/setup" onClick={handleClose}>
                Nightscout Setup
              </Nav.Link>
              <Nav.Link as={Link} to="/settings" onClick={handleClose}>
                Settings
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </div>
  );
}

export default TopBar;
