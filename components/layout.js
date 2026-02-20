'use client';

import Container from 'react-bootstrap/Container';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Spinner } from 'react-bootstrap';
import Navigation from './nav';
import styles from './layout.module.css';
import { getUserProfile, gotUser } from '../actions';

const PUBLIC_PATHS = ['/', '/about', '/auth/signin', '/api/auth/signout', '/studio', '/silence-sandbox/catch-dropped-audio'];

export default function Layout({ children }) {
  const router = useRouter();

  const { status, data } = useSession({
    required: !PUBLIC_PATHS.includes(router.pathname),
  });
  const dispatch = useDispatch();
  useEffect(() => {
    if (status === 'authenticated') {
      dispatch(gotUser({ user: data.user, token: data.djangoToken }));
      dispatch(getUserProfile({ token: data.djangoToken }));
    }
  }, [status, dispatch]);

  const { loaded: userLoaded, token } = useSelector(
    (state) => state.currentUser,
  );
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon-16x16.png" />

        <title>MusicCPR - Create, Perform, Respond, and Connect</title>
        <meta
          name="description"
          content="MusicCPR facilitates music teachers' collection of individual student achievement data that aligns with ensemble repertoire and artistic processes."
        />

        <meta property="og:url" content="/" />
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="MusicCPR - Create, Perform, Respond, and Connect"
        />
        <meta
          property="og:description"
          content="MusicCPR facilitates music teachers' collection of individual student achievement data that aligns with ensemble repertoire and artistic processes."
        />
        <meta property="og:image" content="/MusicCPR-logo.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="musiccpr.org" />
        <meta property="twitter:url" content="/" />
        <meta
          name="twitter:title"
          content="MusicCPR - Create, Perform, Respond, and Connect"
        />
        <meta
          name="twitter:description"
          content="MusicCPR facilitates music teachers' collection of individual student achievement data that aligns with ensemble repertoire and artistic processes."
        />
        <meta name="twitter:image" content="/MusicCPR-logo.png" />
      </Head>
      <Navigation />
      {(!PUBLIC_PATHS.includes(router.pathname) && userLoaded && token) ||
      PUBLIC_PATHS.includes(router.pathname) ? (
        <Container fluid>
          <main className={styles.container}>{children}</main>
        </Container>
      ) : (
        <Spinner
          as="span"
          animation="border"
          size="sm"
          role="status"
          aria-hidden="true"
          variant="primary"
        >
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )}
    </>
  );
}
