import os
import urllib.request
import sys

def download_dataset():
    url = "https://raw.githubusercontent.com/abbylmm/fake_job_posting/main/data/fake_job_postings.csv"
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    dest_path = os.path.join(backend_dir, "data", "fake_job_postings.csv")
    
    print(f"Starting download from {url}...")
    print(f"Destination: {dest_path}")
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    try:
        # Download with progress report
        def progress_callback(block_num, block_size, total_size):
            read_so_far = block_num * block_size
            if total_size > 0:
                percent = read_so_far * 1e2 / total_size
                s = f"\rDownloaded {read_so_far / (1024 * 1024):.2f} MB / {total_size / (1024 * 1024):.2f} MB ({percent:.1f}%)"
                sys.stdout.write(s)
                sys.stdout.flush()
            else:
                sys.stdout.write(f"\rDownloaded {read_so_far / (1024 * 1024):.2f} MB")
                sys.stdout.flush()

        urllib.request.urlretrieve(url, dest_path, progress_callback)
        print("\nDownload completed successfully!")
        
        # Verify file exists and print size
        file_size = os.path.getsize(dest_path)
        print(f"File size on disk: {file_size / (1024 * 1024):.2f} MB")
        
    except Exception as e:
        print(f"\nAn error occurred during download: {e}")
        sys.exit(1)

if __name__ == "__main__":
    download_dataset()
