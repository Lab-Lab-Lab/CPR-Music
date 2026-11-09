// Reports which build is deployed. The prod deploy workflow polls this to
// confirm the new commit is live.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    commit: process.env.NEXT_PUBLIC_GIT_SHA,
    version: process.env.NEXT_PUBLIC_APP_VERSION,
  });
}
