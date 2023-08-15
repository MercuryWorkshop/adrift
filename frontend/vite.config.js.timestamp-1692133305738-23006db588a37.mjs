// vite.config.js
import { defineConfig } from "file:///home/ce/Documents/GitHub/adrift/node_modules/.pnpm/vite@4.4.9/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///home/ce/Documents/GitHub/adrift/node_modules/.pnpm/@sveltejs+vite-plugin-svelte@2.4.5_svelte@4.2.0_vite@4.4.9/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import { viteSingleFile } from "file:///home/ce/Documents/GitHub/adrift/node_modules/.pnpm/github.com+CoolElectronics+vite-plugin-singlefile@0d528cf28b80545b7423150252fd18e7efd8a5e3_ro_mhfpd7pl55om7n5r5r2q4keutu/node_modules/vite-plugin-singlefile/dist/esm/index.js";
var vite_config_default = defineConfig({
  plugins: [
    svelte({}),
    process.env.VITE_ADRIFT_SINGLEFILE && viteSingleFile()
  ],
  build: {
    dev: true,
    minify: false,
    target: "esnext",
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      external: [
        "./sw.js"
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9jZS9Eb2N1bWVudHMvR2l0SHViL2FkcmlmdC9mcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvY2UvRG9jdW1lbnRzL0dpdEh1Yi9hZHJpZnQvZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvY2UvRG9jdW1lbnRzL0dpdEh1Yi9hZHJpZnQvZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiXG5pbXBvcnQgeyBzdmVsdGUgfSBmcm9tIFwiQHN2ZWx0ZWpzL3ZpdGUtcGx1Z2luLXN2ZWx0ZVwiXG5pbXBvcnQgeyB2aXRlU2luZ2xlRmlsZSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1zaW5nbGVmaWxlXCJcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHN2ZWx0ZSh7XG5cbiAgICB9KSxcbiAgICBwcm9jZXNzLmVudi5WSVRFX0FEUklGVF9TSU5HTEVGSUxFICYmIHZpdGVTaW5nbGVGaWxlKClcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICBkZXY6IHRydWUsXG4gICAgbWluaWZ5OiBmYWxzZSxcbiAgICB0YXJnZXQ6IFwiZXNuZXh0XCIsXG4gICAgb3V0RGlyOiBcImRpc3RcIixcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFtcbiAgICAgICAgXCIuL3N3LmpzXCJcbiAgICAgIF1cbiAgICB9XG4gIH1cbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZTLFNBQVMsb0JBQW9CO0FBQzFVLFNBQVMsY0FBYztBQUN2QixTQUFTLHNCQUFzQjtBQUUvQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxPQUFPLENBRVAsQ0FBQztBQUFBLElBQ0QsUUFBUSxJQUFJLDBCQUEwQixlQUFlO0FBQUEsRUFDdkQ7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLGVBQWU7QUFBQSxNQUNiLFVBQVU7QUFBQSxRQUNSO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
