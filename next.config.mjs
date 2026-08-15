/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // La librería ssh2 (usada para conectarse a la OLT) trae un archivo
  // binario opcional para acelerar el cifrado. Sin esta línea, Next.js
  // intenta "empaquetarlo" como si fuera código JavaScript y el build
  // falla. Con esto le decimos que lo use directamente en el servidor
  // en vez de intentar empaquetarlo.
  experimental: {
    serverComponentsExternalPackages: ['ssh2'],
  },
};

export default nextConfig;
