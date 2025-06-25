'use client';

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { approveTaskAndAssignToUser } from '../components/utils/approveTaskAndAssign';


type MealTask = {
  id: string;
  atanan: string;
  tarih: any;
  durum: string;
  yer?: string;
};

type MealPlace = {
  id: string;
  name: string;
};

const GIRL_NAMES = ["esma sahin", "dilara yilmaz", "feyza sahin"];

export default function MealTasks() {
  const [members, setMembers] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<MealTask[]>([]);
  const [assignCount, setAssignCount] = useState<number>(2);
  const [tasksAssigned, setTasksAssigned] = useState(false);
  const [allowDuplicateToday, setAllowDuplicateToday] = useState(false);
  const [ignoreGenderRule, setIgnoreGenderRule] = useState(false);
  const [places, setPlaces] = useState<MealPlace[]>([]);
  const [newPlace, setNewPlace] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(
        query(collection(db, "uyeler"), where("isPresent", "==", true))
      );
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
      setMembers(
        data
          .filter((d) => d.name !== "admin@ai.com")
          .map((d) => ({
            id: d.id,
            name: d.name,
            email: d.email, // ensure email is included if present
          }))
      );
    };

    const fetchPlaces = async () => {
      const snapshot = await getDocs(collection(db, "yemekYerleri"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealPlace[];
      setPlaces(data);
    };

    fetchData();
    fetchPlaces();
  }, []);

  const assignMealTasks = async () => {
    setLoading(true);
    const todayStr = new Date().toDateString();

    const snapshot = await getDocs(collection(db, "yemekGorevleri"));
    const allTasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealTask[];
    setTasks(allTasks);

    const assignedToday = allTasks
      .filter((task) => new Date(task.tarih?.seconds * 1000).toDateString() === todayStr)
      .map((t) => t.atanan);

    const availableMembers = allowDuplicateToday
      ? members
      : members.filter((m) => !assignedToday.includes(m.name));

    if (availableMembers.length < assignCount) {
      alert("Yeterli sayıda yeni görev atanabilecek kişi kalmadı.");
      setLoading(false);
      return;
    }

    const shuffled = [...availableMembers].sort(() => 0.5 - Math.random());
    const selected: { id: string; name: string }[] = [];

    for (let i = 0; i < shuffled.length && selected.length < assignCount; i++) {
      const candidate = shuffled[i];
      const isGirl = GIRL_NAMES.includes(candidate.name.toLowerCase());
      if (
        ignoreGenderRule ||
        selected.every((s) => GIRL_NAMES.includes(s.name.toLowerCase()) === isGirl)
      ) {
        selected.push(candidate);
      }
    }

    const selectedPlaces = [...places].sort(() => 0.5 - Math.random()).slice(0, selected.length);
    const newTasks: MealTask[] = [];

    for (let i = 0; i < selected.length; i++) {
      const newTask = {
        id: "",
        atanan: selected[i].name,
        tarih: Timestamp.now(),
        durum: "beklemede",
        yer: selectedPlaces[i]?.name || "-",
      };
      const docRef = await addDoc(collection(db, "yemekGorevleri"), newTask);
      newTasks.push({ ...newTask, id: docRef.id });
    }

    setTasks((prev) => [
      ...prev.filter((t) => new Date(t.tarih?.seconds * 1000).toDateString() !== todayStr),
      ...newTasks,
    ]);
    setLoading(false);
    setTasksAssigned(true);
  };

  const approveTask = async (task: MealTask) => {
    const ref = doc(db, "yemekGorevleri", task.id);
    await updateDoc(ref, { durum: "onaylandı" });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, durum: "onaylandı" } : t)));

    await approveTaskAndAssignToUser({
      ...task,
      assignedEmail: members.find(m => m.name === task.atanan)?.email,
      id: task.id
    });
  };

  const markAsDone = async (task: MealTask) => {
    const ref = doc(db, "yemekGorevleri", task.id);
    await updateDoc(ref, { durum: "tamamlandı" });
    await addDoc(collection(db, "gorevGecmisi"), {
      atanan: task.atanan,
      tarih: task.tarih,
      gorev: "yemek",
    });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, durum: "tamamlandı" } : t)));
  };

  const addPlace = async () => {
    if (!newPlace.trim()) return;
    await addDoc(collection(db, "yemekYerleri"), { name: newPlace.trim() });
    setNewPlace("");
    const snapshot = await getDocs(collection(db, "yemekYerleri"));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MealPlace[];
    setPlaces(data);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow mt-10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Meal Tasks</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={assignCount}
            onChange={(e) => setAssignCount(parseInt(e.target.value) || 2)}
            className="w-12 border rounded text-center"
          />
          <button
            onClick={assignMealTasks}
            disabled={loading}
            className="bg-gray-200 hover:bg-gray-100 text-black text-sm px-4 py-2 rounded"
          >
            {loading ? "Atanıyor..." : "Görev Ata"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowDuplicateToday}
            onChange={() => setAllowDuplicateToday(!allowDuplicateToday)}
          />
          Aynı kişiye birden fazla görev atanmasına izin ver
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ignoreGenderRule}
            onChange={() => setIgnoreGenderRule(!ignoreGenderRule)}
          />
          Cinsiyet uyum kuralını devre dışı bırak
        </label>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newPlace}
          onChange={(e) => setNewPlace(e.target.value)}
          placeholder="örn. çorba hazırlığı"
          className="border px-3 py-1 rounded w-full"
        />
        <button
          onClick={addPlace}
          className="bg-gray-300 hover:bg-gray-200 text-black px-3 py-1 rounded"
        >
          Ekle
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Görevler atanıyor...</p>
      ) : !tasksAssigned ? (
        <p className="text-sm text-gray-500">Henüz görev ataması yapılmadı.</p>
      ) : (
        <div className="space-y-4">
          {tasks
            .filter((task) => new Date(task.tarih?.seconds * 1000).toDateString() === new Date().toDateString())
            .map((task, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b pb-2 last:border-none"
              >
                <div>
                  <p className="text-sm font-medium">Atanan: {task.atanan}</p>
                  <p className="text-xs text-gray-500">Yer: {task.yer || '-'}</p>
                  <p className="text-xs text-gray-500">
                    Tarih: {new Date(task.tarih?.seconds * 1000).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${task.durum === "tamamlandı"
                      ? "bg-green-100 text-green-800"
                      : task.durum === "onaylandı"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                      }`}
                  >
                    {task.durum}
                  </span>
                  {task.durum === "beklemede" && (
                    <button
                      onClick={() => approveTask(task)}
                      className="text-xs bg-blue-500 text-white px-3 py-1 rounded"
                    >
                      Onayla
                    </button>
                  )}
                  {task.durum === "onaylandı" && (
                    <button
                      onClick={() => markAsDone(task)}
                      className="text-xs bg-green-500 text-white px-3 py-1 rounded"
                    >
                      Yapıldı
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}