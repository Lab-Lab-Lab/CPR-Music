import Alert from 'react-bootstrap/Alert';
import { FaHeadphones, FaMicrophone, FaStopwatch } from 'react-icons/fa';
import { BsEarbuds } from 'react-icons/bs';

function HeadphoneReminder() {
    return <>
        <Alert variant="info" dismissible>
            <Alert.Heading><FaStopwatch /> Count-off</Alert.Heading>
            <p>When you click <FaMicrophone /> below to Start Recording, an accompaniment will play. It begins with a 2-measure count-off to help you know when to start playing.</p>
        </Alert>
        <Alert variant="warning" dismissible>
            <Alert.Heading><FaHeadphones /> Headphones Required</Alert.Heading>
            <p>Please be sure to wear headphones of some kind when you record (earbud or airpod style <BsEarbuds /> is totally fine)!</p>
            {/* <p>When recording, wearing headphones helps your microphone to understand you want to record your instrument (even if there are other sounds playing).</p> */}
        </Alert>
    </>
};

export default HeadphoneReminder;