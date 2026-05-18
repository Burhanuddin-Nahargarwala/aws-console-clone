import boto3
import os

def test_floci():
    print("Testing connection to Floci (http://localhost:4566)...")

    # Configure dummy credentials (required by boto3 even for local endpoints)
    os.environ['AWS_ACCESS_KEY_ID'] = 'test'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'test'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

    # Create an S3 client pointing to the local Floci instance
    s3_client = boto3.client(
        's3',
        endpoint_url='http://localhost:4566'
    )

    bucket_name = 'floci-test-bucket-python'
    file_name = 'hello.txt'
    file_content = 'Hello Floci! This file was uploaded via Python.'

    try:
        # 1. Create a bucket
        print(f"1. Creating S3 bucket: {bucket_name}")
        s3_client.create_bucket(Bucket=bucket_name)

        # 2. Upload a file
        print(f"2. Uploading file '{file_name}' to bucket...")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=file_name,
            Body=file_content
        )

        # 3. Read the file back
        print("3. Reading file back from S3...")
        response = s3_client.get_object(Bucket=bucket_name, Key=file_name)
        downloaded_content = response['Body'].read().decode('utf-8')
        
        print("\n--- Success! ---")
        print(f"Content read from Floci: '{downloaded_content}'")
        
    except Exception as e:
        print("\n--- Error! ---")
        print(f"Something went wrong: {e}")

if __name__ == '__main__':
    test_floci()
