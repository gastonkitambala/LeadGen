/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // OpenStreetMap carries no business photos, so live results render the initial-letter
    // placeholder. Unsplash is here only for the demo dataset.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
