const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

const gatewayPath = path.resolve(__dirname, "services.yml");
const filePath = path.join(__dirname, "nginx.conf");
const apiEndpoints = yaml.load(fs.readFileSync(gatewayPath, "utf8"));
const http = apiEndpoints["http"];
// Define the NGINX configuration as a string
let nginxConfig = `
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
`;
http.forEach((endpoints) => {
  const hostName = endpoints.host;
  const api = endpoints.api;
  nginxConfig += `
    server {
        listen 80;
        server_name ${hostName};`;
  for (let version in api) {
    api[version].forEach((ms) => {
      for (let name in ms) {
        const path = `/api/${version}/${name}`;
        const target = `http://${hostName}:${ms[name].port}`;
        nginxConfig += `
        location ${path} {
            proxy_pass ${target};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }`;
      }
    });
  }
  nginxConfig += `
        location / {
          if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS, PATCH, PUT, DELETE';
            add_header Access-Control-Allow-Headers 'Authorization, Content-Type';
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
          }
        }
      }
      include servers/*;
  }`;
});
// Write the NGINX config to the file
fs.writeFile(filePath, nginxConfig.trim(), (err) => {
  if (err) {
    console.error("Error writing nginx.conf:", err);
  } else {
    console.log("nginx.conf has been created successfully.");
  }
});
