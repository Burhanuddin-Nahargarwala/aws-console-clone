import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AwsLayout from './components/AwsLayout';
import ConsoleHome from './pages/ConsoleHome';
import S3BucketsList from './pages/s3/S3BucketsList';
import CreateBucket from './pages/s3/CreateBucket';
import BucketDetails from './pages/s3/BucketDetails';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AwsLayout />}>
          <Route index element={<ConsoleHome />} />
          <Route path="s3" element={<S3BucketsList />} />
          <Route path="s3/bucket/create" element={<CreateBucket />} />
          <Route path="s3/bucket/:bucketName" element={<BucketDetails />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
