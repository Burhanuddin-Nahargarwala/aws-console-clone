import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RegionProvider } from './lib/RegionContext';
import AwsLayout from './components/AwsLayout';
import ConsoleHome from './pages/ConsoleHome';
import S3BucketsList from './pages/s3/S3BucketsList';
import CreateBucket from './pages/s3/CreateBucket';
import BucketDetails from './pages/s3/BucketDetails';
import LambdaList from './pages/lambda/LambdaList';
import CreateFunction from './pages/lambda/CreateFunction';
import FunctionDetail from './pages/lambda/FunctionDetail';
import DynamoDBList from './pages/dynamodb/DynamoDBList';
import CreateTable from './pages/dynamodb/CreateTable';
import TableDetail from './pages/dynamodb/TableDetail';
import LogGroups from './pages/cloudwatch/LogGroups';
import LogStreams from './pages/cloudwatch/LogStreams';
import LogEvents from './pages/cloudwatch/LogEvents';
import InstanceList from './pages/ec2/InstanceList';
import LaunchInstance from './pages/ec2/LaunchInstance';
import InstanceDetail from './pages/ec2/InstanceDetail';
import KeyPairs from './pages/ec2/KeyPairs';
import SecurityGroups from './pages/ec2/SecurityGroups';
import './index.css';

function App() {
  return (
    <RegionProvider>
    <Router>
      <Routes>
        <Route path="/" element={<AwsLayout />}>
          <Route index element={<ConsoleHome />} />
          <Route path="s3" element={<S3BucketsList />} />
          <Route path="s3/bucket/create" element={<CreateBucket />} />
          <Route path="s3/bucket/:bucketName" element={<BucketDetails />} />
          <Route path="s3/bucket/:bucketName/*" element={<BucketDetails />} />
          <Route path="lambda" element={<LambdaList />} />
          <Route path="lambda/create" element={<CreateFunction />} />
          <Route path="lambda/function/:functionName" element={<FunctionDetail />} />
          <Route path="dynamodb" element={<DynamoDBList />} />
          <Route path="dynamodb/create" element={<CreateTable />} />
          <Route path="dynamodb/table/:tableName" element={<TableDetail />} />
          <Route path="cloudwatch" element={<LogGroups />} />
          <Route path="cloudwatch/logs" element={<LogGroups />} />
          <Route path="cloudwatch/logs/streams" element={<LogStreams />} />
          <Route path="cloudwatch/logs/events" element={<LogEvents />} />
          <Route path="ec2" element={<InstanceList />} />
          <Route path="ec2/launch" element={<LaunchInstance />} />
          <Route path="ec2/instance/:instanceId" element={<InstanceDetail />} />
          <Route path="ec2/key-pairs" element={<KeyPairs />} />
          <Route path="ec2/security-groups" element={<SecurityGroups />} />
        </Route>
      </Routes>
    </Router>
    </RegionProvider>
  );
}

export default App;
