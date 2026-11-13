import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, getDoc, doc, orderBy, deleteDoc } from "firebase/firestore"
import { Project } from "@/types"

const convertTimestamps = (data: Record<string, unknown>) => {
    const result = { ...data };

    const createdAt = result.createdAt as { toDate?: () => Date } | undefined;
    if (createdAt?.toDate) {
        result.createdAt = createdAt.toDate().toISOString();
    } else if (!result.createdAt || typeof result.createdAt !== 'string') {
        result.createdAt = new Date().toISOString();
    }

    const updatedAt = result.updatedAt as { toDate?: () => Date } | undefined;
    if (updatedAt?.toDate) {
        result.updatedAt = updatedAt.toDate().toISOString();
    }

    return result;
}



export interface ProjectFilters {
    search?: string
    category?: string
    tag?: string
}

export async function getProjects(filters?: ProjectFilters): Promise<Project[]> {
    try {
        const projectsCol = collection(db, 'projects');
        const projectSnapshot = await getDocs(projectsCol);
        let projectList = projectSnapshot.docs.map(doc => ({
            id: doc.id,
            ...convertTimestamps(doc.data())
        } as Project));

        // Populate waitlistCount per project
        const waitlistSnapshot = await getDocs(collection(db, 'waitlist'));
        const waitlistCounts: Record<string, number> = {};
        waitlistSnapshot.docs.forEach(wd => {
            const pid = (wd.data() as Record<string, unknown>).projectId as string;
            waitlistCounts[pid] = (waitlistCounts[pid] || 0) + 1;
        });
        projectList = projectList.map(p => ({
            ...p,
            waitlistCount: waitlistCounts[p.id] ?? 0,
        }));

        // Filter in-memory
        if (filters) {
            const { search, category, tag } = filters

            if (search) {
                const searchLower = search.toLowerCase()
                projectList = projectList.filter(p =>
                    p.title.toLowerCase().includes(searchLower) ||
                    p.description.toLowerCase().includes(searchLower)
                )
            }

            if (category) {
                projectList = projectList.filter(p => p.category?.toLowerCase() === category.toLowerCase())
            }

            if (tag) {
                projectList = projectList.filter(p => p.tags?.some(t => t.toLowerCase() === tag.toLowerCase()))
            }
        }

        return projectList;
    } catch (error) {
        console.error("Error fetching projects:", error);
        return [];
    }
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
    try {
        const projectsCol = collection(db, 'projects');
        const q = query(projectsCol, where("slug", "==", slug), where("status", "==", "active"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return null;
        }

        const doc = querySnapshot.docs[0];
        return {
            id: doc.id,
            ...convertTimestamps(doc.data())
        } as Project;
    } catch (error) {
        console.error(`Error fetching project with slug ${slug}:`, error);
        return null;
    }
}

export async function getProjectById(id: string): Promise<Project | null> {
    try {
        const docRef = doc(db, "projects", id)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
            return { id: docSnap.id, ...convertTimestamps(docSnap.data()) } as Project
        } else {
            return null
        }
    } catch (error) {
        console.error("Error fetching project by ID:", error)
        return null
    }
}

export async function deleteProject(id: string): Promise<void> {
    try {
        await deleteDoc(doc(db, "projects", id));
    } catch (error) {
        console.error("Error deleting project:", error);
        throw error;
    }
}
