This is the simplest possible release script, that I could make

I took the smallest portion possible from 
https://github.com/webpro/release-it
Then, adapted that to what I needed. Pushing release assets from a CI environment.

Make an assets folder in the directory root

You give it a files in the assets folder, A tag(release an tag are considered the same here) tell it which repo to use and an token, and boom done.

export GITHUBR_TOKEN="YourToken"
export GITHUBR_OWNER="username"
export GITHUBR_REPO="theRepo""
export GITHUBR_VERSION="someversionumber"


