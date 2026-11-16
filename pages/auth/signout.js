import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import Layout from '../../components/layout';
import { loggedOut } from '../../actions';
import { logout as logoutSession } from '../../lib/auth';

function SignOut() {
  const router = useRouter();

  const dispatch = useDispatch();
  const logout = async () => {
    await logoutSession();
    dispatch(loggedOut());
    router.push('/');
  };
  return (
    <Layout>
      <Row>
        <Col md={4}>
          <h1>Are you sure you want to Sign Out?</h1>
          <Button variant="warning" onClick={logout}>
            Sign out
          </Button>
        </Col>
      </Row>
    </Layout>
  );
}

export default SignOut;
