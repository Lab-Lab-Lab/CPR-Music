import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import { signOut, useSession } from 'next-auth/react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import { useRef, useEffect, useState } from 'react';
import Layout from '../../components/layout';
import { logoutUser } from '../../actions';

function SignOut() {
  const router = useRouter();
  const container = useRef(null);
  const [loaded, setLoad] = useState(false);
  const [widthBool, setWidthBool] = useState(false);

  const { data: session } = useSession();
  const dispatch = useDispatch();
  const logout = (ev) => {
    dispatch(logoutUser(session.djangoToken));
    signOut();
    router.push('/');
  };

  // gets remaining height for the 100vh viewport of site and dynamically size the signout area
  function getHeightAndWidth() {
    const rect = document.querySelector('nav').getBoundingClientRect();
    const { height } = rect;
    const windowHeight = window.innerHeight;
    container.current.style.height = `${windowHeight - height}px`;

    const containerWidth = container.current.getBoundingClientRect();
    const { width } = containerWidth;
    if (width > 900) {
      setWidthBool(false);
    } else {
      setWidthBool(true);
    }
  }

  // check if container is loaded
  useEffect(() => {
    const interval = setInterval(() => {
      if (container.current) {
        setLoad(true);
        clearInterval(interval);
      }
    }, 0);
  }, []);

  // sets container height to auto fill to the bottom
  useEffect(() => {
    if (loaded) {
      getHeightAndWidth();
      window.addEventListener('resize', getHeightAndWidth);
    }
  }, [loaded]);
  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        ref={container}
      >
        <figure style={{ width: '200px', marginBottom: '40px' }}>
          <img
            style={{ width: '100%', height: 'auto' }}
            src="/MusicCPR-logo.png"
          />
        </figure>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            width: widthBool ? '90%' : '35%',
            border: 'solid 2px rgba(138, 136, 136, 1)',
            padding: '20px 0 20px 0',
            borderRadius: '3px',
            height: '200px',
            maxWidth: '600px',
            boxShadow: '0px 0px 20px -3px rgba(0,0,0,0.25)',
          }}
        >
          <h1
            style={{
              textAlign: 'center',
              width: '70%',
              fontSize: '1.7rem',
            }}
          >
            Are you sure you want to sign out?
          </h1>
          <Button style={{ width: '70%' }} onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </Layout>
  );
}

export default SignOut;
