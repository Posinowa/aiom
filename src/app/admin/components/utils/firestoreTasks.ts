import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    Timestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type Task = {
    atanan: string;
    tarih: any;
    durum: string;
    yer?: string;
    email?: string;
    companyID: string;
};

type TaskType = "temizlik" | "yemek";

export async function assignUnifiedTasks(
    type: TaskType,
    companyID: string,
    members: { id: string; name: string; email?: string }[],
    places: string[],
    assignCount: number
) {
    const todayStr = new Date().toDateString();

    const q = query(collection(db, "tasks"), where("companyID", "==", companyID));
    const snapshot = await getDocs(q);
    let tasksDoc = snapshot.docs[0];

    let tasksData: any = tasksDoc?.data() || {
        companyID,
        temizlikGorevListesi: [],
        yemekGorevListesi: [],
    };

    const currentList = tasksData[`${type}GorevListesi`] || [];
    const assignedToday = currentList.filter(
        (t: any) =>
            new Date(t.tarih?.seconds * 1000).toDateString() === todayStr
    ).map((t: any) => t.atanan);

    const availableMembers = members.filter((m) => !assignedToday.includes(m.name));
    const shuffled = [...availableMembers].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, assignCount);

    const shuffledPlaces = [...places].sort(() => 0.5 - Math.random());

    const newTasks = selected.map((m, i) => ({
        atanan: m.name,
        tarih: Timestamp.now(),
        durum: "beklemede",
        yer: shuffledPlaces[i] || "-",
        email: m.email,
    }));

    const updatedList = [...currentList, ...newTasks];
    const updatedData = {
        ...tasksData,
        [`${type}GorevListesi`]: updatedList,
    };

    if (tasksDoc) {
        await addDoc(collection(db, "tasks"), updatedData); // veya updateDoc
    } else {
        await addDoc(collection(db, "tasks"), updatedData);
    }

    return newTasks;
}

export async function fetchMyTasks(uid: string, companyID: string) {
    const q = query(collection(db, "tasks"), where("companyID", "==", companyID));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    const doc = snapshot.docs[0];
    const data = doc.data();

    const allTasks = [
        ...(data.temizlikGorevListesi || []),
        ...(data.yemekGorevListesi || []),
    ];

    return allTasks.filter((t: any) => t.uid === uid || t.email); // email veya uid ile eşleştir
}
