import { useState, useEffect, useRef } from "react";
import { Navbar, Container, Nav, NavDropdown } from "react-bootstrap";
import { selfID } from "../lib/remote/backend";
import { Link, useLocation } from "react-router";

type MenuItem = { label: string; to: string };
type MenuSection = { label: string; items: MenuItem[] };

const MENU_SECTIONS: MenuSection[] = [
  {
    label: "Treatment",
    items: [
      { label: "Low Correction", to: "/rescue" },
      { label: "Basal Injection", to: "/basal" },
      { label: "Insulin Dosing", to: "/insulin" },
      { label: "Activity", to: "/activity" },
    ],
  },
  {
    label: "Customization",
    items: [
      { label: "Insulin Variants", to: "/insulinvariants" },
      { label: "Custom Foods", to: "/customfoods" },
      { label: "Rescue Variants", to: "/rescuevariants" },
    ],
  },
  {
    label: "Utility",
    items: [
      { label: "Dextrose", to: "/dextrose" },
      { label: "Insulin Expirations", to: "/expirations" },
    ],
  },
  {
    label: "Data",
    items: [
      { label: "History", to: "/history" },
      { label: "Statistics", to: "/statistics" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Configuration", to: "/settings" },
      { label: "Nightscout Setup", to: "/setup" },
    ],
  },
  // If you have a truly single, high-priority route, you can keep it top-level:
  // { label: "Dashboard", items: [{ label: "Hub", to: "/hub" }] },
];

function TopBar() {
  const [expanded, setExpanded] = useState(false);
  const topBarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const handleToggle = () => setExpanded((e) => !e);
  const handleClose = () => setExpanded(false);

  // Close on outside click
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close the mobile menu after navigation
  useEffect(() => {
    setExpanded(false);
  }, [location.pathname]);

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
            {selfID}
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" onClick={handleToggle} />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              {MENU_SECTIONS.map((section) =>
                section.items.length === 1 ? (
                  <Nav.Link
                    key={section.items[0].to}
                    as={Link}
                    to={section.items[0].to}
                    onClick={handleClose}
                  >
                    {section.items[0].label}
                  </Nav.Link>
                ) : (
                  <NavDropdown
                    title={section.label}
                    key={section.label}
                    id={`dd-${section.label}`}
                  >
                    {section.items.map((item) => (
                      <NavDropdown.Item
                        as={Link}
                        to={item.to}
                        key={item.to}
                        onClick={handleClose}
                      >
                        {item.label}
                      </NavDropdown.Item>
                    ))}
                  </NavDropdown>
                )
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </div>
  );
}

export default TopBar;
