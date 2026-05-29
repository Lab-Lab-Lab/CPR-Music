import Alert from 'react-bootstrap/Alert';
import { FaHeadphones } from 'react-icons/fa';
import { BsEarbuds } from 'react-icons/bs';

function HeadphoneReminder() {
    return <Alert variant="warning">
        <Alert.Heading><FaHeadphones /> Headphones</Alert.Heading>
        <p>Please be sure to wear headphones of some kind (earbud or airpod style <BsEarbuds /> is totally fine)!</p>
        <p>When recording, headphones help your microphone to understand you want to record your instrument.</p>
    </Alert>
};

export default HeadphoneReminder;