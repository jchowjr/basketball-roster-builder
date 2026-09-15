/** @type {import('next').NextConfig} */
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // GitHub Pages project sites live below /repository-name. Local development stays at /.
  basePath: process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}` : '',
};

export default nextConfig;
