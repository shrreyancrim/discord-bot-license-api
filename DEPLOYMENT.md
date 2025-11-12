# Deployment Guide

This guide shows you how to deploy the Discord Bot License Verification API on your own server.

## Prerequisites

- Node.js 18+ installed
- MongoDB installed and running (or MongoDB Atlas account)
- A server/VPS with a public IP address or domain

## Deployment Options

### Option 1: VPS/Dedicated Server (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/discord-bot-license-api.git
   cd discord-bot-license-api
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up MongoDB:**
   - Install MongoDB: https://www.mongodb.com/docs/manual/installation/
   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas
   - Start MongoDB service: `sudo systemctl start mongod`

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   
   Update the following:
   ```env
   MONGODB_URI=mongodb://localhost:27017/license-verification
   API_KEY=your-generated-super-secret-key-here
   PORT=5000
   NODE_ENV=production
   ```

5. **Build the application:**
   ```bash
   npm run build
   ```

6. **Start the server:**
   ```bash
   npm start
   ```

7. **Set up as a system service (using PM2):**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name license-api
   pm2 startup
   pm2 save
   ```

8. **Configure reverse proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

9. **Enable HTTPS with Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Option 2: Cloud Platforms

#### Heroku

1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Add MongoDB addon: `heroku addons:create mongolab:sandbox`
5. Set environment variables:
   ```bash
   heroku config:set API_KEY=your-secret-key
   heroku config:set NODE_ENV=production
   ```
6. Deploy: `git push heroku main`

#### DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure build settings:
   - Build Command: `npm install && npm run build`
   - Run Command: `npm start`
3. Add MongoDB database component
4. Set environment variables in the dashboard
5. Deploy

#### AWS EC2

1. Launch an EC2 instance (Ubuntu recommended)
2. Connect via SSH
3. Install Node.js and MongoDB
4. Follow the VPS deployment steps above
5. Configure security groups to allow HTTP/HTTPS traffic

#### Railway

1. Connect your GitHub repository to Railway
2. Add MongoDB plugin
3. Set environment variables
4. Deploy automatically on push

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `API_KEY` | Secret key for API authentication | Yes |
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | Environment (production/development) | Yes |

## Security Checklist

- ✅ Use a strong, randomly generated API_KEY
- ✅ Enable MongoDB authentication
- ✅ Use HTTPS (SSL/TLS certificates)
- ✅ Configure firewall to only allow necessary ports
- ✅ Keep MongoDB connection string secure
- ✅ Regularly update dependencies
- ✅ Set up automated backups for MongoDB
- ✅ Use environment variables, never hardcode secrets
- ✅ Enable rate limiting (already configured in the app)

## Monitoring and Maintenance

### Check Application Status
```bash
pm2 status
pm2 logs license-api
```

### MongoDB Backup
```bash
mongodump --uri="mongodb://localhost:27017/license-verification" --out=/backup/$(date +%Y%m%d)
```

### Update Application
```bash
git pull
npm install
npm run build
pm2 restart license-api
```

## Troubleshooting

### Application won't start
- Check logs: `pm2 logs license-api`
- Verify MongoDB is running: `sudo systemctl status mongod`
- Check environment variables: `pm2 env license-api`

### MongoDB connection failed
- Verify MongoDB is running
- Check connection string in .env
- Ensure MongoDB authentication is configured correctly

### API returns 403 errors
- Verify API_KEY is set correctly
- Check that clients are sending X-API-Key header
- Review request logs

## Scaling

For high-traffic scenarios:

1. **Horizontal scaling**: Deploy multiple instances behind a load balancer
2. **MongoDB replica set**: Set up MongoDB clustering
3. **Caching**: Add Redis for frequently accessed license data
4. **CDN**: Use Cloudflare or similar for DDoS protection

## Support

For issues or questions:
- Check the README.md for API documentation
- Review DISCORD_BOT_SETUP.md for client integration
- Check application logs
- Monitor MongoDB logs

## Cost Estimation

**Basic Setup (100-1000 bots):**
- VPS: $5-10/month (DigitalOcean, Linode, Vultr)
- MongoDB: Free (self-hosted) or $0 (MongoDB Atlas free tier)
- Domain: $10-15/year
- **Total: ~$5-10/month**

**Production Setup (1000+ bots):**
- VPS: $20-50/month (higher specs)
- MongoDB: $9-25/month (MongoDB Atlas M2/M5)
- Domain + SSL: $10-15/year
- **Total: ~$30-75/month**
