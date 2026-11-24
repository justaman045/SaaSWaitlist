import { db } from "@/lib/firebase"
import {
    collection,
    getDocs,
    query,
    where,
    getDoc,
    doc,
    deleteDoc,
    updateDoc,
    writeBatch,
} from "firebase/firestore"
import { Project } from "@/types"

/** Fired after a background reconcile so client lists can refetch. */
export const PROJECTS_UPDATED_EVENT = "saaswaitlist:projects-updated"

/**
 * The number of writes a single Firestore batch may contain.
 *
 * Firestore rejects a batch with more than 500 writes, so bulk deletes are
 * split into chunks below this limit.
 */
const MAX_BATCH_WRITES = 450

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

/**
 * Normalises a raw Firestore document into the shape the UI expects.
 *
 * Every read path must go through this so `waitlistCount` is always a
 * number — otherwise the project cards show "0 waiting" while the detail
 * page hides the counter entirely.
 *
 * The document id is passed in separately because it is not part of the
 * document data. It has to be carried explicitly: the id keys the React
 * lists, builds the `/admin/edit/<id>` links, identifies the project in a
 * waitlist entry, and links a request to its project.
 */
function normalizeProject(id: string, data: Record<string, unknown>): Project {
    const converted = convertTimestamps(data)

    return {
        ...converted,
        // The document id wins over any `id` field inside the document.
        id,
        waitlistCount: typeof converted.waitlistCount === "number" ? converted.waitlistCount : 0,
    } as Project;
}

function sortByNewest(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime()
        const bTime = new Date(b.createdAt).getTime()
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
    })
}

export interface ProjectFilters {
    search?: string
    category?: string
    tag?: string
}

export interface ProjectsResult {
    projects: Project[]
    /** Non-null when the read failed — lets callers tell "empty" from "broken". */
    error: string | null
}

/**
 * Applies the public filter parameters to an already-loaded project list.
 *
 * Filtering happens in memory (safe against legacy documents with missing
 * fields) so no composite Firestore indexes are required.
 *
 * It is exported so the server-side cached read can filter *outside* the
 * cache: the cache key would otherwise grow with every distinct `?search=`
 * value, which lets one visitor fill the cache with junk entries.
 */
export function filterProjects(projectList: Project[], filters?: ProjectFilters): Project[] {
    if (!filters) return projectList

    const { search, category, tag } = filters

    if (search) {
        const searchLower = search.toLowerCase()
        projectList = projectList.filter(project => {
            const title = (project.title ?? "").toLowerCase()
            const description = (project.description ?? "").toLowerCase()
            return title.includes(searchLower) || description.includes(searchLower)
        })
    }

    if (category) {
        projectList = projectList.filter(
            project => project.category?.toLowerCase() === category.toLowerCase()
        )
    }

    if (tag) {
        projectList = projectList.filter(
            project => project.tags?.some(t => t.toLowerCase() === tag.toLowerCase())
        )
    }

    return projectList
}

/**
 * Reads every project document and returns the result together with any
 * error, so callers can distinguish an empty catalogue from a failed read.
 */
export async function getProjectsResult(filters?: ProjectFilters): Promise<ProjectsResult> {
    try {
        const projectsCol = collection(db, 'projects');
        const projectSnapshot = await getDocs(projectsCol);
        const projectList = projectSnapshot.docs.map(snapshot => normalizeProject(snapshot.id, snapshot.data()));

        // waitlistCount is maintained on the project document by the waitlist
        // form, so no public read access to the waitlist collection is needed.

        // Filter in-memory (safe against legacy documents with missing fields)
        return { projects: sortByNewest(filterProjects(projectList, filters)), error: null };
    } catch (error) {
        console.error("Error fetching projects:", error);
        return {
            projects: [],
            error: error instanceof Error ? error.message : "Unknown error fetching projects",
        };
    }
}

/**
 * Reads a project by its slug and returns the result together with any
 * error, so callers can distinguish "missing" from "broken".
 *
 * A missing project is a legitimate answer; a failed read is not. The two
 * must never look the same — a failed read rendered as a 404 would tell a
 * visitor that a live project does not exist.
 */
export async function getProjectBySlugResult(slug: string): Promise<ProjectResult> {
    try {
        const projectsCol = collection(db, 'projects');
        const q = query(projectsCol, where("slug", "==", slug));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { project: null, error: null };
        }

        const projectDoc = querySnapshot.docs[0];
        return {
            project: normalizeProject(projectDoc.id, projectDoc.data()),
            error: null,
        };
    } catch (error) {
        console.error(`Error fetching project with slug ${slug}:`, error);
        return {
            project: null,
            error: error instanceof Error ? error.message : "Unknown error fetching project",
        };
    }
}

export interface ProjectResult {
    project: Project | null
    /** Non-null when the read failed — lets callers tell "missing" from "broken". */
    error: string | null
}

export async function getProjectByIdResult(id: string): Promise<ProjectResult> {
    try {
        const docRef = doc(db, "projects", id)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
            return { project: normalizeProject(docSnap.id, docSnap.data()), error: null }
        }

        return { project: null, error: null }
    } catch (error) {
        console.error("Error fetching project by ID:", error)
        return {
            project: null,
            error: error instanceof Error ? error.message : "Unknown error fetching project",
        }
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

/**
 * Deletes every waitlist entry that belongs to a project.
 *
 * The waitlist collection holds personal data (email addresses). Leaving the
 * entries behind after the project is gone keeps that data around forever
 * with no way for the visitor to withdraw it.
 *
 * Requires admin read access to the `waitlist` collection, which is exactly
 * the audience that can delete a project.
 */
export async function deleteWaitlistEntriesForProject(projectId: string): Promise<number> {
    const snapshot = await getDocs(
        query(collection(db, "waitlist"), where("projectId", "==", projectId))
    )

    if (snapshot.empty) return 0

    // Firestore rejects a batch with more than 500 writes, so a project with
    // more signups than that is deleted in several chunks. Without this the
    // cleanup of a popular project fails outright and the visitor email
    // addresses stay behind.
    const refs = snapshot.docs.map((entry) => entry.ref)
    for (let offset = 0; offset < refs.length; offset += MAX_BATCH_WRITES) {
        const batch = writeBatch(db)
        for (const ref of refs.slice(offset, offset + MAX_BATCH_WRITES)) {
            batch.delete(ref)
        }
        await batch.commit()
    }

    return snapshot.size
}

/**
 * Re-derives the public waitlist counter from the waitlist collection.
 *
 * The counter on the project document is maintained by the public signup
 * form, and the Firestore rules cannot tie an increment to the entry that
 * caused it — the entry id contains the address, which must not become
 * publicly readable. A caller can therefore push the counter up without a
 * matching entry. This function repairs the counter: the number of entries
 * is the truth, and the stored counter is corrected whenever it drifts.
 *
 * Admin-only: reading the waitlist collection requires an allowlisted,
 * verified account.
 */
export async function reconcileWaitlistCounts(): Promise<number> {
    let updated = 0

    const projectSnapshot = await getDocs(collection(db, "projects"))

    for (const projectDoc of projectSnapshot.docs) {
        const waitlistSnapshot = await getDocs(
            query(collection(db, "waitlist"), where("projectId", "==", projectDoc.id))
        )

        const actual = waitlistSnapshot.size
        const stored = projectDoc.data().waitlistCount

        // Nothing to do when the counter already matches the entries.
        if (typeof stored === "number" && stored === actual) continue

        await updateDoc(doc(db, "projects", projectDoc.id), {
            waitlistCount: actual,
        })
        updated++
    }

    return updated
}
