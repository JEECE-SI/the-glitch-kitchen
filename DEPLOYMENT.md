# Deployment Guide - The Glitch Kitchen

## Prerequisites

- Docker and Docker Compose installed on your VPS
- Supabase account with database configured
- API keys for Gemini and/or OpenAI

## Database Setup

1. **Create a Supabase project** at https://supabase.com

2. **Run the database schema**:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the entire content of `supabase_schema.sql`
   - Execute the SQL script

3. **Verify tables are created**:
   - Check that all tables exist: `games`, `brigades`, `players`, `recipe_notes`, `inventory`, `catalog_roles`, `catalog_missions`, `catalog_contests`, `catalog_recipe`, `catalog_fragments`, `game_logs`

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI API Keys (at least one is required)
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```

## Deployment with Docker

### Option 1: Docker Compose (Recommended)

1. **Clone the repository** on your VPS:
```bash
git clone <your-repo-url>
cd the-glitch-kitchen
```

2. **Create `.env.local`** file with your environment variables

3. **Build and start the container**:
```bash
docker-compose up -d --build
```

4. **Check logs**:
```bash
docker-compose logs -f
```

5. **Stop the application**:
```bash
docker-compose down
```

### Option 2: Docker Only

1. **Build the image**:
```bash
docker build -t the-glitch-kitchen .
```

2. **Run the container**:
```bash
docker run -d \
  --name the-glitch-kitchen \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  the-glitch-kitchen
```

## Nginx Reverse Proxy (Optional but Recommended)

If you want to use a domain name and SSL:

1. **Install Nginx**:
```bash
sudo apt update
sudo apt install nginx
```

2. **Create Nginx configuration** (`/etc/nginx/sites-available/glitch-kitchen`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. **Enable the site**:
```bash
sudo ln -s /etc/nginx/sites-available/glitch-kitchen /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **Install SSL with Certbot** (optional):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Updating the Application

1. **Pull latest changes**:
```bash
git pull origin main
```

2. **Rebuild and restart**:
```bash
docker-compose up -d --build
```

## Troubleshooting

### Check container status
```bash
docker-compose ps
```

### View logs
```bash
docker-compose logs -f app
```

### Restart the application
```bash
docker-compose restart
```

### Remove and rebuild
```bash
docker-compose down
docker-compose up -d --build
```

## Security Recommendations

1. **Firewall**: Configure UFW to only allow necessary ports
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Environment Variables**: Never commit `.env.local` to version control

3. **Supabase RLS**: Consider implementing Row Level Security policies for production

4. **Regular Updates**: Keep Docker, Node.js, and dependencies up to date

## Performance Optimization

- Consider using a CDN for static assets
- Enable Supabase connection pooling
- Monitor resource usage with `docker stats`
- Set up log rotation for Docker logs

## Monitoring

Monitor your application with:
```bash
# CPU and Memory usage
docker stats the-glitch-kitchen

# Application logs
docker-compose logs -f --tail=100
```
