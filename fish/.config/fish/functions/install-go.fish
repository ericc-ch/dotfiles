function install_go
    # Check if version argument was provided
    if test (count $argv) -ne 1
        echo "Error: Please provide a Go version (e.g., 1.24.1)"
        return 1
    end

    set -l version $argv[1]
    set -l filename "go$version.linux-amd64.tar.gz"
    set -l download_url "https://go.dev/dl/$filename"
    set -l tmp_dir /tmp/install-go
    set -l tar_path "$tmp_dir/$filename"

    # Create temp directory if it doesn't exist
    mkdir -p $tmp_dir

    echo "Installing Go $version..."

    # Download Go archive
    curl -L -o $tar_path $download_url

    # Check if we need sudo for /usr/local access
    set -l sudo_cmd ""
    if not test -w /usr/local
        set sudo_cmd sudo
    end

    # Remove old Go installation and extract new one
    echo "Removing old Go and installing new version..."
    eval $sudo_cmd rm -rf /usr/local/go
    eval $sudo_cmd tar -C /usr/local -xzf $tar_path

    echo "Successfully installed Go $version"
end
