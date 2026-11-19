import Link from 'next/link';
import { useEffect } from 'react';
import Nav from 'react-bootstrap/Nav';
import { useSelector } from 'react-redux';
import * as Sentry from "@sentry/nextjs";
import { useAuth } from '../lib/auth';

function LoginOut() {
  const { data: session } = useAuth();
  const currentUserInfo = useSelector((state) => state.currentUser);
  useEffect(() => {
    if (currentUserInfo.loaded) {
      Sentry.setUser({ id: currentUserInfo.id, username: currentUserInfo.username });
    }
  }, [session, currentUserInfo.loaded]);
  // const loginStatus = useSelector((state) => state.loginStatus);
  return session ? (
    <Link href="/auth/signout" passHref legacyBehavior>
      <Nav.Link>
        Logout
        {currentUserInfo.loaded ? ` ${currentUserInfo.username}` : ''}
      </Nav.Link>
    </Link>
  ) : (
    <Link href="/auth/signin?callbackUrl=/courses" passHref legacyBehavior>
      <Nav.Link>Login</Nav.Link>
    </Link>
  );
}

export default LoginOut;
