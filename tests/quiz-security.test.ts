import { describe, expect, it } from 'vitest';
import { parseQuizSubmission, parseStoredQuestions, questionsForClient, scoreQuiz } from '../src/worker/lib/quizzes';

const questionsJson = JSON.stringify([
  { id: 'q1', question: 'First?', options: ['A', 'B'], correctIndex: 1, explanation: 'B is correct.' },
  { id: 'q2', question: 'Second?', options: ['C', 'D'], correctIndex: 0, explanation: 'C is correct.' },
]);

describe('Quiz answer handling', () => {
  it('hides answer keys and explanations until completion', () => {
    const questions = parseStoredQuestions(questionsJson);
    expect(questions).not.toBeNull();
    const pending = JSON.parse(questionsForClient(questions!, false));
    expect(pending[0]).not.toHaveProperty('correctIndex');
    expect(pending[0]).not.toHaveProperty('explanation');

    const completed = JSON.parse(questionsForClient(questions!, true));
    expect(completed[0]).toMatchObject({ correctIndex: 1, explanation: 'B is correct.' });
  });

  it('rejects malformed stored questions and answer submissions', () => {
    expect(parseStoredQuestions('{bad json')).toBeNull();
    expect(parseStoredQuestions(JSON.stringify([{ id: 'q1', options: ['A'], correctIndex: 2 }]))).toBeNull();
    expect(parseQuizSubmission({ answers: { q1: '1' } })).toBeNull();
    expect(parseQuizSubmission({ answers: { q1: -1 } })).toBeNull();
  });

  it('scores on the server and rejects incomplete, extra, or out-of-range answers', () => {
    const questions = parseStoredQuestions(questionsJson)!;
    expect(scoreQuiz(questions, { q1: 1, q2: 0 })).toBe(2);
    expect(scoreQuiz(questions, { q1: 0, q2: 1 })).toBe(0);
    expect(scoreQuiz(questions, { q1: 1 })).toBeNull();
    expect(scoreQuiz(questions, { q1: 1, q2: 0, extra: 0 })).toBeNull();
    expect(scoreQuiz(questions, { q1: 2, q2: 0 })).toBeNull();
  });
});
