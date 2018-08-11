const fs = require('fs');
const path = require('path');
const process = require('process');
const GitHubApi = require('@octokit/rest');
const retry = require('async-retry');
const globby = require('globby');
const mime = require('mime-types');
const _ = require('lodash');


const noop = Promise.resolve();

const NO_RETRIES_NEEDED = [400, 401, 404, 422];

const githubClients = {};


_.templateSettings.interpolate = /\${([\s\S]+?)}/g;

const format = (template, ...replacements) => {
    if (!_.includes(template, '%')) {
        return template;
    } else {
        return util.format(template, ...replacements);
    }
};

const template = (input, context) => {
    return _.template(input)(context);
};

const truncateLines = (input, maxLines = 10) => {
    const lines = input.split('\n');
    const surplus = lines.length - maxLines;
    const output = lines.slice(0, maxLines).join('\n');
    return surplus > 0 ? `${output}\n...and ${surplus} more` : output;
};


const getGithubClient = ({ host, token }) => {
    if (!githubClients[host]) {
        const client = new GitHubApi({
            version: '3.0.0',
            baseUrl: `https://${host === 'github.com' ? 'api.github.com' : host}${host === 'github.com' ? '' : '/api/v3'}`,
            timeout: github.timeout,
            headers: {
                'user-agent': 'webpro/release-it'
            }
        });

        client.authenticate({
            type: 'oauth',
            token
        });

        githubClients[host] = client;
    }
    return githubClients[host];
};

const parseErrorMessage = err => {
    let msg = err;
    try {
        if (err instanceof Error) {
            const { message, code, status } = err;
            msg = `${code} ${status} (${message.replace(/[\n\r]+/g, ' ')})`;
        }
    } catch (err) {
        console.log(err);
    }
    return msg;
};

const release = ({ version, tagName, repo, changelog = '', github }) => {


    const { preRelease: prerelease, draft, token } = github;
    const { owner, project } = repo;
    const host = github.host || repo.host;
    const tag_name = format(tagName, version);
    const name = format(github.releaseName, version);
    const githubClient = getGithubClient({ host, token });

    return retry(
        async bail =>
    new Promise((resolve, reject) => {
        githubClient.repos.createRelease(
        {
            owner,
            repo: project,
            tag_name,
            name,
            body: changelog,
            prerelease,
            draft
        },
        (err, response) => {
        if (err) {
            const msg = parseErrorMessage(err);
            const { code } = err;
            if (_.includes(NO_RETRIES_NEEDED, parseInt(code, 10))) {
                bail(new Error(msg));
                return;
            }
            return reject(msg);
        } else {

    resolve(response.data);
}
}
);
}),
    {
        retries: 2
    }
);
};

const uploadAsset = ({ release, repo, github, filePath }) => {
    const { token } = github;
    const host = github.host || repo.host;
    const githubClient = getGithubClient({ host, token });

    const url = release.upload_url;
    const name = path.basename(filePath);
    const contentType = mime.contentType(name) || 'application/octet-stream';
    const contentLength = fs.statSync(filePath).size;

    return retry(
        async bail =>
    new Promise((resolve, reject) => {
        githubClient.repos.uploadAsset(
        {
            url,
            file: fs.createReadStream(filePath),
            name,
            contentType,
            contentLength
        },
        (err, response) => {
        if (err) {
            const msg = parseErrorMessage(err);
            const { code } = err;
            if (_.includes(NO_RETRIES_NEEDED, parseInt(code, 10))) {
                bail(new Error(msg));
                return;
            }
            return reject(msg);
        }
    resolve(response.data);
}
);
}),
    {
        retries: 2
    }
);
};

const uploadAssets = ({ release, repo, github }) => {
    const { assets } = github;

    if (!assets) {
        return noop;
    }


    return globby(assets).then(files => {
        if (!files.length) {
    }
    return Promise.all(files.map(filePath => uploadAsset({ release, repo, filePath, github })));
});
};

var repository ={ owner:process.env.GITHUBR_OWNER, project:process.env.GITHUBR_REPO };
var github={ preRelease: false, draft:false, token:process.env.GITHUB_TOKEN, host:'github.com',assets:'assets/*.zip' };

release({version:process.env.GITHUBR_VERSION, tagName:process.env.GITHUBR_VERSION,repo:repository ,changelog:'', github:github}).then((releaseObject)=>{
    console.log(releaseObject);
    return uploadAssets({release:releaseObject,repo:repository , github:github}).catch((err)=>{console.log(err); process.exit(1);});

}).catch((err)=>{
    console.log(err);
    process.exit(1);
});
