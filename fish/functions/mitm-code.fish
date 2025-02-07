function mitm-code --wraps='code' --description 'Test vscode with proxy. For use with mitmproxy'
    set -x http_proxy "http://localhost:8080"
    set -x https_proxy "http://localhost:8080"

    code --ignore-certificate-errors $argv
end
