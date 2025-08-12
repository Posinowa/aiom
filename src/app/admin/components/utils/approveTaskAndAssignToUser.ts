import { db } from '../../../lib/firebase';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

interface ApproveParams {
    id: string;
    companyID: string;
    tip: string;
    atanan?: string;
    yer?: string;
    tarih?: any;
    assignedEmail?: string;
}

export const approveTaskAndAssignToUser = async ({
    id,
    companyID,
    tip,
    atanan,
    yer,
    tarih,
    assignedEmail
}: ApproveParams) => {
    try {

    } catch (error) {
        console.error("gorevGecmisi yazma hatası:", error);
    }
};
