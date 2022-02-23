# Trello Notification Add-in

[![Build Status](https://github.com/ringcentral/trello-notification-app/workflows/CI%20Pipeline/badge.svg?branch=main)](https://github.com/ringcentral/trello--notification-app/actions)

[![Coverage Status](https://coveralls.io/repos/github/ringcentral/trello-notification-app/badge.svg?branch=main)](https://coveralls.io/github/ringcentral/trello-notification-app?branch=main)

[Trello notification add-in](https://www.ringcentral.com/apps/trello-beta-for-ringcentral) and Bot for [RingCentral app](https://www.ringcentral.com/apps/rc-app).

## Development

### 1. Clone this project

```
$ git clone https://github.com/ringcentral/trello-notification-app.git
```

### 2. Install dependencies

Inside project root:

```
$ npm install
```

### 3. Start Ngrok to create a URI for public internet access

```
$ npm run ngrok
```

Keep this process active, and you will get a publish uri as `https://xxxxxxxxxx.ngrok.io` that connected with your local port `localhost:6066`.

### 4. Create a free RingCentral add-in app

Please follow [here](https://developers.ringcentral.com/guide/team-messaging/add-ins/creation) to create a RingCentral notification add-in app.

In `App Features`, enable `Interactive Messages`, then input URI `https://xxxxxx.ngrok.io/interactive-messages`. Please replace with your ngrok domain.

In `Integrated installation in RingCentral app` section, enable `This app can be installed via the web`, then input URI `https://xxxxxx.ngrok.io/webhooks/new`.

### 5. Create a free RingCentral Bots app

Please follow [here](https://developers.ringcentral.com/guide/team-messaging/add-ins/creation) to create a RingCentral Bots app.

In `App Permissions` section, add `Read Accounts`, `Team Messaging` and `Webhook Subscriptions`.

In `OAuth Redirect URI` section, input `https://xxxxxx.ngrok.io/bot/oauth`. Please replace with your ngrok domain.

In `App Features`, enable `Interactive Messages`, then input URI `https://xxxxxx.ngrok.io/interactive-messages`. Please replace with your ngrok domain.

### 6. Start webpack server to compile and host static JS file.

In other console window:

```
$ npm run webpack-server
```

### 7. Create `.env` file

```
$ cp .env.sample .env
```

Edit `.env` file as `.env.sample` to set environment variables.
The `APP_SERVER` is publish uri that we get from ngrok.
For `DATABASE_CONNECTION_URI`, we can just keep `sqlite://./db.sqlite`. We will use sqlite as local database.
`TRELLO_APP_KEY` and `TRELLO_APP_SECRET` are from `https://trello.com/app-key`.

### 8. Setup Database

We will use sqlite as local database. Please install sqlite3 in your machine firstly.

Init Database:

```
$ npm run initDB
```

### 7. Start local server

```
$ npm start
```

### 9. Test at RingCentral sandbox

Go to `https://app.devtest.ringcentral.com/apps/sandbox` with your sandbox account, you can get your apps in development here. Click Plus icon to add your notification app or bots to test.

## Deploy with serverless

### 1. Compile JS files

```
$ npm run webpack-build
```

And get all JS assets file at public folder. Upload all files in public into CDN or static web server.

### 2. Create `serverless-deploy/env.yml` file

```
$ cp serverless-deploy/env.default.yml serverless-deploy/env.yml
```

Edit `serverless-deploy/env.yml` to set environment variables.
We will get `APP_SERVER` after first deploy. So now just keep it blank.

### 3. Create `serverless-deploy/serverless.yml` file

```
$ cp serverless-deploy/serverless.default.yml serverless-deploy/serverless.yml
```

Edit `serverless-deploy/env.yml` to update serverless settings.
The Dynamo `TableName` should be `${DYNAMODB_TABLE_PREFIX}webhooks`. `DYNAMODB_TABLE_PREFIX` is environment variable that we set upper. `ASSETS_PATH` is uri where you host JS files in `Step 1`.

### 4. Deploy

```
$ npm run serverless-build
$ npm run serverless-deploy
```

In first deploy, you will get lambda uri in console output: `https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod`.
Copy the uri, and update environment variable `APP_SERVER` with it in `serverless-deploy/env.yml` file. Then deploy again:

```
$ npm run serverless-deploy
```

Then update app settings in [RingCentral developer portal](https://developers.ringcentral.com/), with your new `APP_SERVER`.
