import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

/**
 * Public API to fetch Print Designs
 * Query Parameters:
 * - category: Optional filter by category name or ID
 * - tags: Optional filter by comma-separated tags (contains, case-insensitive)
 * - status: Optional filter by status (default is ENABLED)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const categoryStr = url.searchParams.get("category");
  const tagsStr = url.searchParams.get("tags");
  const statusFilter = url.searchParams.get("status") || "ENABLED";

  try {
    const whereClause: any = {
      status: statusFilter,
    };

    if (categoryStr) {
      whereClause.OR = [
        { category: { name: { contains: categoryStr, mode: 'insensitive' } } },
        { categoryId: categoryStr }
      ];
    }

    if (tagsStr) {
      const tagList = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        whereClause.AND = tagList.map(tag => ({
          tags: { contains: tag, mode: 'insensitive' }
        }));
      }
    }

    const designs = await prisma.printDesign.findMany({
      where: whereClause,
      include: {
        category: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return json(designs, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("API Designs Error:", error);
    return json({ error: "Failed to fetch designs" }, { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const action = () => json({ error: "Method not allowed" }, { status: 405 });
