import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import studentsData from '../lib/data/students.json';
import interactionsData from '../lib/data/initialInteractions.json';

const prisma = new PrismaClient();

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = (hash * 33) ^ str.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

async function main() {
  console.log('Seeding database...');

  // 1. Seed Preset Instructors / Users
  const presetUsers = [
    { id: 'admin', name: 'Admin', email: 'admin@kkh.edu', role: 'admin', hall: 'Main Office', rawPass: 'admin' },
    { id: 'inst-1', name: 'Ashutosh Rana', email: 'ashutosh.rana@kkh.edu', role: 'instructor', hall: 'Hall A', rawPass: 'evaluator123' },
    { id: 'inst-2', name: 'Priya Sharma', email: 'priya.sharma@kkh.edu', role: 'instructor', hall: 'Hall B', rawPass: 'evaluator123' },
    { id: 'inst-3', name: 'Rahul Verma', email: 'rahul.verma@kkh.edu', role: 'instructor', hall: 'Hall C', rawPass: 'evaluator123' },
    { id: 'inst-4', name: 'Sneha Patel', email: 'sneha.patel@kkh.edu', role: 'instructor', hall: 'Hall D', rawPass: 'evaluator123' },
    { id: 'inst-5', name: 'Vikram Singh', email: 'vikram.singh@kkh.edu', role: 'instructor', hall: 'Hall E', rawPass: 'evaluator123' },
    { id: 'inst-6', name: 'Adarsh', email: 'adarsh@kkh.edu', role: 'instructor', hall: 'Hall 2', rawPass: 'evaluator123' },
  ];

  for (const user of presetUsers) {
    const hashedPassword = await bcrypt.hash(user.rawPass, 10);
    // Also store simple hash in metadata format or hashed string
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        hall: user.hall,
        passwordHash: hashedPassword,
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hall: user.hall,
        passwordHash: hashedPassword,
      },
    });
  }
  console.log('Preset users seeded.');

  // 2. Seed Students
  console.log(`Seeding ${studentsData.length} students...`);
  const formattedStudents = studentsData.map((s) => ({
    id: s.id,
    name: s.name,
    degree: s.degree || 'BITS',
    section: s.section || 'S001',
    level: s.level || 'Level 0',
    currentStep: s.currentStep || '1.0 Introduction',
    currentTopic: s.currentTopic || '1.0 Introduction',
    hall: s.hall || 'Hall 1',
    instructor: s.instructor || 'Unassigned',
    interactionCount: s.interactionCount || 0,
    status: s.status || 'Pending Interaction 1',
    lastInteractionDate: s.lastInteractionDate || null,
  }));

  // Chunk student inserts to avoid parameter limits in Postgres
  const chunkSize = 100;
  for (let i = 0; i < formattedStudents.length; i += chunkSize) {
    const chunk = formattedStudents.slice(i, i + chunkSize);
    await prisma.student.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
  console.log('Students seeded.');

  // 3. Seed Interaction Logs
  console.log(`Seeding ${interactionsData.length} interaction logs...`);
  for (const log of interactionsData) {
    // Check if student exists before inserting
    const student = await prisma.student.findUnique({
      where: { id: log.studentId },
    });

    if (student) {
      await prisma.interactionLog.upsert({
        where: { id: log.id },
        update: {},
        create: {
          id: log.id,
          studentId: log.studentId,
          studentName: log.studentName || student.name,
          instructorName: log.instructorName || 'Unknown',
          instructorEmail: (log as any).instructorEmail || null,
          topics: log.topics || '',
          statusPostInteraction: log.statusPostInteraction || 'Need to Revisit',
          rating: typeof log.rating === 'number' ? log.rating : 0.0,
          questionsAsked: log.questionsAsked || '',
          remarks: log.remarks || '',
          performedWell: log.performedWell || '',
          improvementAreas: log.improvementAreas || '',
          tweakedQuestions: log.tweakedQuestions || '',
          actionItems: log.actionItems || '',
          meetRecording: log.meetRecording || '',
          granolaTranscript: log.granolaTranscript || '',
          interactionRound: log.interactionRound || 1,
          date: log.date || new Date().toISOString().split('T')[0],
        },
      });
    }
  }
  console.log('Interaction logs seeded.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
