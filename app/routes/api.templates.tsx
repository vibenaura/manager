import { json, type LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

/**
 * Public API to fetch T-Shirt Templates
 * Query Parameters:
 * - tags: Optional filter by comma-separated tags (contains, case-insensitive)
 * - category: Optional (currently unsupported for templates, but reserved)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const tagsStr = url.searchParams.get("tags") || url.searchParams.get("tag"); // Support both singular and plural for backward compatibility
  const categoryStr = url.searchParams.get("category");

  try {
    const whereClause: any = {};

    if (tagsStr) {
      const tagList = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        whereClause.AND = tagList.map(tag => ({
          tags: { contains: tag, mode: 'insensitive' }
        }));
      }
    }

    // Since TShirtTemplate doesn't have a category field in schema, we skip filtering unless it's tags-based.
    // If we wanted to search tags as a proxy for category:
    if (categoryStr) {
      whereClause.tags = { contains: categoryStr, mode: 'insensitive' };
    }

    const templates = await prisma.tShirtTemplate.findMany({
      where: whereClause,
      include: { colorVariants: true },
      orderBy: { createdAt: "desc" },
    });

    return json(templates, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("API Templates Error:", error);
    return json({ error: "Failed to fetch templates" }, { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const action = () => json({ error: "Method not allowed" }, { status: 405 });

