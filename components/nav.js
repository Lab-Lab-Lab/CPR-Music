'use client';

import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import LoginOut from './loginout';
import { getEnrollments } from '../api';
import CourseSelector from './courseSelector';
import { NavActivityPicker } from './student/navActivityPicker';
import { PiecePicker } from './student/piecePicker';

function Navigation() {
  const router = useRouter();
  const { slug, piece } = router.query;
  const {
    isLoading,
    error,
    data: enrollments,
  } = useQuery('enrollments', getEnrollments, { staleTime: 5 * 60 * 1000 });
  // const currentEnrollment = slug && enrollments && enrollments.filter((elem) => elem.course.slug === slug)[0]

  return (
    <Navbar bg="primary" variant="dark" expand="sm">
      <Container fluid>
        <Link href="/" passHref>
          <Navbar.Brand>MusicCPR</Navbar.Brand>
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {enrollments ? (
              <CourseSelector />
            ) : (
              <Nav.Item>
                <Link href="/courses" passHref legacyBehavior>
                  <Nav.Link>Courses</Nav.Link>
                </Link>
              </Nav.Item>
            )}
            {slug && <PiecePicker />}
            {piece && <NavActivityPicker />}
          </Nav>
          <Nav>
            <Link href="/studio" passHref legacyBehavior>
              <Nav.Link>Studio</Nav.Link>
            </Link>
            <Link href="/about" passHref legacyBehavior>
              <Nav.Link>About</Nav.Link>
            </Link>
            <LoginOut />
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;


