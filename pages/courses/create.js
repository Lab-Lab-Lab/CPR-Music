import { useAuth } from '../../lib/auth';

import Layout from '../../components/layout';
import AddEditCourse from '../../components/forms/addEditCourse';

export default function CreateCourse() {
  const { data: session } = useAuth();

  return (
    <Layout>
      <h1>Create a course</h1>

      <AddEditCourse session={session} />
    </Layout>
  );
}
