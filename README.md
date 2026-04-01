# Vibenaura Manager

**Vibenaura Manager** is a premium Shopify application designed for high-performance 3D garment customization. It empowers merchants to manage T-shirt templates (bases) and print designs with a visual-first approach, optimized for the Vibenaura 3D "Vibe" engine.

---

## 🚀 Core Features

### 👕 T-Shirt Template Management
*   **3D Visual Bases**: Define templates for garments with support for front, back, and side textures.
*   **Color Variant Architecture**: Manage multiple color variants per template, each with its own dedicated texture overrides.
*   **Standardized Sizing**: Full support for standard sizes (S - 3XL) mapped to 3D dimensions.

### 🖼️ High-Performance Print Gallery
*   **Visual IndexTable**: A dense, grid-like view of all print assets with small thumbnails.
*   **Instant Search & Filters**: Filter by category, status (Active/Disabled), or use the quick search for names and tags.
*   **High-Res Previews**: Click any thumbnail to open a high-resolution modal preview, optimized for checking transparency and print quality.

### 🧠 Smart Asset Deduplication
*   **MD5 File Hashing**: Every image uploaded is hashed at the binary level.
*   **Zero Redundancy**: If you upload the same image twice (even for different designs), the system detects the duplicate and reuses the existing Shopify URL.
*   **Database Shadowing**: Prevents redundant `PrintDesign` records if the same asset is added multiple times, keeping your gallery clean.

### 🎨 Design System
*   **Polaris First**: Built using Shopify Polaris for a native Admin feel.
*   **Glassmorphism & Gradients**: Premium UI elements for a modern, high-end "Aura" aesthetic.

---

## 🛠️ Technology Stack
*   **Framework**: [Remix](https://remix.run) (Vite-powered).
*   **UI System**: [Shopify Polaris](https://polaris.shopify.com/) + Custom Tailwind CSS.
*   **Persistence**: [Prisma](https://www.prisma.io/) with SQLite/PostgreSQL.
*   **3D Engine**: [Three.js](https://threejs.org/) for garment visualization.
*   **Authentication**: Shopify App Bridge with session-token-based security.

---

## 🛠️ Getting Started

### Prerequisites
1.  **Node.js**: v18.20 or higher.
2.  **Shopify Partner Account**.
3.  **Development Store**.

### Setup
1.  Clone the repository and install dependencies:
    ```shell
    npm install
    ```
2.  Initialize the database:
    ```shell
    npx prisma migrate dev
    npx prisma generate
    ```
3.  Configure your environment variables in `.env`.

### Local Development
Run the app in development mode:
```shell
npm run dev
```

---

## 🏗️ Architecture Notes

### Image Upload Pipeline
The `/api/upload` route handles multipart form data, calculates an MD5 hash, and checks the `UploadedFile` table.
- **New File**: Uploads to Shopify Staged Uploads API -> Creates GenericFile -> Polls for URL -> Saves to DB.
- **Duplicate File**: Instantly returns the cached URL from the DB.

### Navigation Guardrails
The app utilizes Remix `useNavigate` and `Link` components exclusively to maintain the `shop` and `host` context, preventing unauthenticated breakout loops common in embedded apps.

---

*Built with ❤️ by the Vibenaura Team.*
