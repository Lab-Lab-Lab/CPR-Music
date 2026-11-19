import { useRouter } from 'next/router';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { Alert } from 'react-bootstrap';
import { useState } from 'react';
import Layout from '../../components/layout';
import { login, safeCallbackUrl } from '../../lib/auth';

export default function SignIn() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (ev) => {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await login(form.get('username'), form.get('password'));
      router.push(
        safeCallbackUrl(router.query.callbackUrl, '/', ['/', '/dashboard', '/profile']),
      );
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Form onSubmit={onSubmit} className="mt-3">
        <Form.Group as={Row} className="mb-3" controlId="formUsername">
          <Form.Label column sm={2}>
            Username
          </Form.Label>
          <Col sm={10}>
            <Form.Control
              type="text"
              name="username"
              placeholder="Username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </Col>
        </Form.Group>
        <Form.Group as={Row} className="mb-3" controlId="formPassword">
          <Form.Label column sm={2}>
            Password
          </Form.Label>
          <Col sm={10}>
            <Form.Control
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </Col>
        </Form.Group>
        <Button type="submit" disabled={submitting}>
          Sign in
        </Button>
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}{' '}
            <a
              href={`${process.env.NEXT_PUBLIC_BACKEND_HOST}/accounts/password/reset/`}
            >
              Forgot your password?
            </a>
          </Alert>
        )}
      </Form>
    </Layout>
  );
}
