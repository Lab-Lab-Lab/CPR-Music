import { getCsrfToken, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import { Alert } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Layout from '../../components/layout';

// https://github.com/nextauthjs/next-auth/issues/2426#issuecomment-1141406105
// try this instead?

export default function SignIn({ csrfToken }) {
  const session = useSession();
  const [csrf, setCsrf] = useState(csrfToken);
  const { error } = useRouter().query;
  const [pass, changePassView] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    async function fetchCsrf() {
      const token = await getCsrfToken();
      setCsrf(token);
    }
    if (session.status !== 'loading') {
      fetchCsrf();
    }
  }, [session.status]);

  function viewPass(event) {
    event.preventDefault();
    changePassView(!pass);
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
  }
  return (
    <Layout>
      <Container>
        <Form
          method="post"
          action="/api/auth/callback/credentials"
          className="mt-3"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <input name="csrfToken" type="hidden" defaultValue={csrf} />
          <Form.Group
            as={Row}
            className="mb-3 d-flex justify-content-center"
            controlId="formUsername"
            style={{ width: '100%' }}
          >
            <Form.Label column sm={2}>
              Username
            </Form.Label>
            <Col md={4} xs={10}>
              <Form.Control
                type="text"
                name="username"
                placeholder="Username"
                style={{ borderRadius: '30px', borderWidth: '3px' }}
              />
            </Col>
          </Form.Group>
          <Form.Group
            as={Row}
            className="mb-3 d-flex justify-content-center"
            controlId="formPassword"
            style={{ width: '100%' }}
          >
            <Form.Label column sm={2}>
              Password
            </Form.Label>
            <Col md={4} xs={10}>
              <Form.Control
                type={pass ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                className="position-relative"
                style={{
                  borderRadius: '30px',
                  borderWidth: '3px',
                  paddingRight: '50px',
                }}
              />
              <button
                type="button"
                onClick={viewPass}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="position-absolute"
                style={{
                  top: '50%',
                  right: '30px',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'transparent',
                  opacity: isHovered ? '100%' : '50%',
                  border: 'none',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  transition: 'opacity 0.2s linear',
                }}
              >
                {pass ? (
                  <FaEyeSlash style={{ width: '30px', height: '30px' }} />
                ) : (
                  <FaEye style={{ width: '30px', height: '30px' }} />
                )}
              </button>
            </Col>
          </Form.Group>
          <Button
            type="submit"
            style={{ width: '100px', marginBottom: '3rem' }}
          >
            Sign in
          </Button>
          {error && <SignInError error={error} />}
        </Form>
      </Container>
    </Layout>
  );
}

// This is the recommended way for Next.js 9.3 or newer
// export async function getServerSideProps(context) {
//   const token = await getCsrfToken(context);
//   return {
//     props: {
//       csrfToken: token ?? null,
//     },
//   };
// }

const errors = {
  Signin: 'Try signing with a different account.',
  OAuthSignin: 'Try signing with a different account.',
  OAuthCallback: 'Try signing with a different account.',
  OAuthCreateAccount: 'Try signing with a different account.',
  EmailCreateAccount: 'Try signing with a different account.',
  Callback: 'Try signing with a different account.',
  OAuthAccountNotLinked:
    'To confirm your identity, sign in with the same account you used originally.',
  EmailSignin: 'Check your email address.',
  CredentialsSignin: 'Sign in failed. Check your login credentials.',
  default: 'Unable to sign in.',
};
function SignInError({ error = errors.default }) {
  const errorMessage = error && (errors[error] ?? errors.default);
  return (
    <Alert variant="danger" style={{ width: 'fit-content' }}>
      {errorMessage}{' '}
      {error === 'CredentialsSignin' && (
        <a
          href={`${process.env.NEXT_PUBLIC_BACKEND_HOST}/accounts/password/reset/`}
        >
          Forgot your password?
        </a>
      )}
    </Alert>
  );
}
