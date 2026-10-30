import { useState } from 'react';
import type { z } from 'zod';
import {
  artifactSchema,
  proposalSchema,
  type TaskArtifact,
  type TaskParticipant,
  type TaskProposal,
} from '@taskboard/core';
import type { Board, TaskDetail } from './types';
import { collaborationApi as actions } from './collaborationApi';
import { api, request } from './api';

type Props = {
  detail: TaskDetail;
  board: Board;
  userId: string;
  disabled: boolean;
  offline?: boolean;
  demo: boolean;
  onOpen: (id: string) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
};
const kindNames = {
  pr: 'PR',
  commit: '提交',
  screenshot: '截图',
  document: '文档',
  test: '测试',
  other: '其他',
};
const blankArtifact: z.input<typeof artifactSchema> = {
  kind: 'pr',
  title: '',
  url: null,
  text: '',
  verificationScope: '',
  limitations: '',
  executionId: null,
};

export function CollaborationPanel({
  detail,
  board,
  userId,
  disabled,
  offline,
  demo,
  onOpen,
  run,
}: Props) {
  const task = detail.task;
  const participants = detail.participants ?? [];
  const children = detail.children ?? [];
  const dependencies = detail.dependencies ?? [];
  const proposals = detail.proposals ?? [];
  const artifacts = (detail.artifacts ?? []).filter((artifact) => !artifact.deletedAt);
  const admin = ['owner', 'admin'].includes(board.space.role);
  const manages = admin || task.assigneeId === userId;
  const [personId, setPersonId] = useState('');
  const [dependencyId, setDependencyId] = useState('');
  const [childTitle, setChildTitle] = useState('');
  const [required, setRequired] = useState(true);
  const [artifact, setArtifact] = useState(blankArtifact);
  const [editingArtifact, setEditingArtifact] = useState<string | undefined>();
  const [proposalKind, setProposalKind] = useState<'split' | 'requirements' | 'decision'>('split');
  const [proposalText, setProposalText] = useState('');
  const [proposalAcceptance, setProposalAcceptance] = useState('');
  const [impact, setImpact] = useState('');
  const perform = (action: () => Promise<unknown>) =>
    run(async () => {
      if (demo) throw new Error('演示模式不提交协作更改；请在真实任务中操作。');
      return action();
    });
  const name = (id: string | null | undefined) =>
    board.members.find((member) => member.id === id)?.name ?? (id ? '成员已离开' : '未分配');
  const taskLink = (id: string) => {
    const linked = board.tasks.find((item) => item.id === id);
    return (
      <button className="text-button task-link" onClick={() => onOpen(id)}>
        {linked ? `TB-${linked.number} ${linked.title}` : '查看关联任务'}
      </button>
    );
  };
  const saveProposal = () => {
    const body =
      proposalKind === 'split'
        ? {
            kind: 'split' as const,
            payload: {
              children: proposalText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((title) => ({
                  title,
                  assigneeId: task.assigneeId ?? null,
                  reviewerId: task.reviewerId ?? null,
                  acceptanceCriteria: proposalAcceptance,
                  requiredForParent: true,
                })),
            },
          }
        : proposalKind === 'requirements'
          ? {
              kind: 'requirements' as const,
              payload: {
                description: proposalText,
                acceptanceCriteria: proposalAcceptance,
                impact,
              },
            }
          : { kind: 'decision' as const, payload: { body: proposalText } };
    return perform(async () => {
      await actions.proposal(task.id, body, task.version);
      setProposalText('');
      setProposalAcceptance('');
      setImpact('');
    });
  };
  if (offline && detail.participants === undefined)
    return (
      <section className="detail-section">
        <h3>协作记录暂不可用</h3>
        <p className="muted">
          离线缓存只包含任务摘要，未包含职责、关系、成果和运行记录。缺少记录不表示它们不存在；恢复连接后重新读取。
        </p>
      </section>
    );
  return (
    <>
      <details className="detail-section collaboration-section" open>
        <summary>
          <h3>职责与进度</h3>
          <span>{participants.length} 位参与者</span>
        </summary>
        <p className="muted">
          总负责人：{name(task.assigneeId)} · 验收人：{name(task.reviewerId)}
        </p>
        {!task.reviewerId && (
          <p className="workflow-warning">
            尚未指定验收人；提交验收前请在上方补派。历史已完成任务保留原记录。
          </p>
        )}
        {participants.length === 0 && (
          <p className="muted">尚无参与者。由总负责人或空间管理员分配职责。</p>
        )}
        {participants.map((participant) => (
          <ParticipantEditor
            key={`${participant.userId}:${participant.updatedAt}`}
            participant={participant}
            name={name(participant.userId)}
            disabled={disabled || (!manages && participant.userId !== userId)}
            removable={manages}
            onSave={(value) =>
              perform(() =>
                actions.participant(
                  task.id,
                  participant.userId,
                  {
                    responsibility: value.responsibility,
                    progress: value.progress,
                    summary: value.summary,
                    blockedReason: value.blockedReason,
                  },
                  task.version,
                ),
              )
            }
            onRemove={() =>
              perform(() => actions.removeParticipant(task.id, participant.userId, task.version))
            }
          />
        ))}
        {manages && (
          <div className="collaboration-inline">
            <label>
              新增参与者
              <select
                value={personId}
                onChange={(event) => setPersonId(event.target.value)}
                disabled={disabled}
              >
                <option value="">选择有执行权限的成员</option>
                {board.members
                  .filter(
                    (member) =>
                      member.role !== 'viewer' &&
                      !participants.some((person) => person.userId === member.id),
                  )
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button ghost"
              disabled={disabled || !personId}
              onClick={() =>
                perform(async () => {
                  await actions.participant(
                    task.id,
                    personId,
                    { responsibility: '', progress: 0, summary: '', blockedReason: '' },
                    task.version,
                  );
                  setPersonId('');
                })
              }
            >
              添加参与者
            </button>
          </div>
        )}
      </details>
      <details
        className="detail-section collaboration-section"
        open={children.length > 0 || !!task.parentTaskId}
      >
        <summary>
          <h3>子任务与依赖</h3>
          <span>{children.length} 个子任务</span>
        </summary>
        {task.parentTaskId && (
          <p>
            父任务：{taskLink(task.parentTaskId)}
            {task.requiredForParent !== false ? '（必要）' : '（非必要）'}
          </p>
        )}
        {children.length === 0 && (
          <p className="muted">检查清单适合简单步骤；需要独立领取与验收时创建子任务。</p>
        )}
        <ul className="relation-list">
          {children.map((child) => (
            <li key={child.id}>
              <span>
                {taskLink(child.id)}
                <small>
                  {board.statuses.find((status) => status.id === child.statusId)?.name ??
                    '未知状态'}{' '}
                  · {child.requiredForParent !== false ? '必要子任务' : '非必要子任务'}
                </small>
              </span>
              {manages && (
                <button
                  className="text-button"
                  disabled={disabled}
                  onClick={() =>
                    perform(() => api.patchTask(child.id, { parentTaskId: null }, child.version))
                  }
                >
                  解除父子关系
                </button>
              )}
            </li>
          ))}
        </ul>
        {children.length > 0 && (
          <p className="workflow-warning">父任务需要独立集成验收；子任务完成不会自动完成父任务。</p>
        )}
        {manages && (
          <div className="collaboration-form">
            <label>
              子任务标题
              <input
                value={childTitle}
                maxLength={240}
                onChange={(event) => setChildTitle(event.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="check-item">
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
                disabled={disabled}
              />
              此子任务是父任务的必要条件
            </label>
            <button
              className="button ghost"
              disabled={disabled || !childTitle.trim()}
              onClick={() =>
                perform(async () => {
                  await request(`/tasks/${task.id}/children`, {
                    method: 'POST',
                    version: task.version,
                    body: {
                      title: childTitle.trim(),
                      statusId: board.statuses.find((status) => status.semantic === 'todo')?.id,
                      assigneeId: task.assigneeId,
                      reviewerId: task.reviewerId ?? null,
                      requiredForParent: required,
                    },
                  });
                  setChildTitle('');
                })
              }
            >
              创建独立子任务
            </button>
          </div>
        )}
        <h4>前置依赖</h4>
        {dependencies.length === 0 && <p className="muted">没有前置依赖。</p>}
        <ul className="relation-list">
          {dependencies.map((dependency) => (
            <li key={dependency.dependsOnTaskId}>
              {taskLink(dependency.dependsOnTaskId)}
              {manages && (
                <button
                  className="text-button"
                  disabled={disabled}
                  onClick={() =>
                    perform(() =>
                      actions.dependency(task.id, dependency.dependsOnTaskId, task.version, true),
                    )
                  }
                >
                  移除依赖
                </button>
              )}
            </li>
          ))}
        </ul>
        {manages && (
          <div className="collaboration-inline">
            <label>
              添加前置任务
              <select
                value={dependencyId}
                onChange={(event) => setDependencyId(event.target.value)}
                disabled={disabled}
              >
                <option value="">选择同空间任务</option>
                {board.tasks
                  .filter(
                    (item) =>
                      item.id !== task.id &&
                      !item.archived &&
                      !dependencies.some((dependency) => dependency.dependsOnTaskId === item.id),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      TB-{item.number} {item.title}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button ghost"
              disabled={disabled || !dependencyId}
              onClick={() =>
                perform(async () => {
                  await actions.dependency(task.id, dependencyId, task.version);
                  setDependencyId('');
                })
              }
            >
              添加依赖
            </button>
          </div>
        )}
      </details>
      <details className="detail-section collaboration-section" open>
        <summary>
          <h3>成果与验证</h3>
          <span>{artifacts.length} 项</span>
        </summary>
        {artifacts.length === 0 && (
          <p className="muted">添加 PR、提交、截图、文档或测试记录，写明验证范围和限制。</p>
        )}
        {artifacts.map((item) => (
          <article className="artifact-item" key={item.id}>
            <b>
              {kindNames[item.kind]} · {item.title}
            </b>
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.url}
              </a>
            )}
            <p>{item.text}</p>
            <p>
              <strong>验证范围：</strong>
              {item.verificationScope || '未记录'}
            </p>
            <p>
              <strong>限制：</strong>
              {item.limitations || '未记录'}
            </p>
            {(item.createdBy === userId || manages) && (
              <div className="exec-actions">
                <button
                  className="text-button"
                  disabled={disabled}
                  onClick={() => {
                    setEditingArtifact(item.id);
                    setArtifact({
                      kind: item.kind,
                      title: item.title,
                      url: item.url,
                      text: item.text,
                      verificationScope: item.verificationScope,
                      limitations: item.limitations,
                      executionId: item.executionId,
                    });
                  }}
                >
                  编辑
                </button>
                <button
                  className="text-button"
                  disabled={disabled}
                  onClick={() =>
                    perform(() => actions.removeArtifact(task.id, item.id, task.version))
                  }
                >
                  删除并保留历史
                </button>
              </div>
            )}
          </article>
        ))}
        <details>
          <summary>{editingArtifact ? '编辑成果' : '添加成果'}</summary>
          <div className="collaboration-form">
            <label>
              类型
              <select
                value={artifact.kind}
                disabled={disabled}
                onChange={(event) =>
                  setArtifact({ ...artifact, kind: event.target.value as TaskArtifact['kind'] })
                }
              >
                {Object.entries(kindNames).map(([value, title]) => (
                  <option key={value} value={value}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              标题
              <input
                value={artifact.title}
                maxLength={240}
                disabled={disabled}
                onChange={(event) => setArtifact({ ...artifact, title: event.target.value })}
              />
            </label>
            <label>
              HTTPS 链接
              <input
                type="url"
                value={artifact.url ?? ''}
                disabled={disabled}
                onChange={(event) => setArtifact({ ...artifact, url: event.target.value || null })}
              />
            </label>
            <label>
              变更说明
              <textarea
                value={artifact.text ?? ''}
                disabled={disabled}
                onChange={(event) => setArtifact({ ...artifact, text: event.target.value })}
              />
            </label>
            <label>
              验证范围
              <textarea
                value={artifact.verificationScope ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  setArtifact({ ...artifact, verificationScope: event.target.value })
                }
              />
            </label>
            <label>
              已知限制
              <textarea
                value={artifact.limitations ?? ''}
                disabled={disabled}
                onChange={(event) => setArtifact({ ...artifact, limitations: event.target.value })}
              />
            </label>
            <div className="exec-actions">
              <button
                className="button ghost"
                disabled={disabled || !artifact.title.trim()}
                onClick={() =>
                  perform(async () => {
                    await actions.artifact(task.id, artifact, task.version, editingArtifact);
                    setArtifact(blankArtifact);
                    setEditingArtifact(undefined);
                  })
                }
              >
                {editingArtifact ? '保存成果' : '添加成果'}
              </button>
              {editingArtifact && (
                <button
                  className="text-button"
                  onClick={() => {
                    setArtifact(blankArtifact);
                    setEditingArtifact(undefined);
                  }}
                >
                  取消编辑
                </button>
              )}
            </div>
          </div>
        </details>
      </details>
      <details
        className="detail-section collaboration-section"
        open={proposals.some((proposal) => proposal.state === 'proposed')}
      >
        <summary>
          <h3>提案与确认决策</h3>
          <span>需求 v{task.requirementsVersion ?? 1}</span>
        </summary>
        <p className="muted">AI 提议与已确认需求分开。提案只有经总负责人或管理员确认后才生效。</p>
        {proposals.map((proposal) => (
          <ProposalReview
            key={proposal.id}
            proposal={proposal}
            description={task.description}
            acceptance={task.acceptanceCriteria ?? ''}
            name={name}
            members={board.members}
            disabled={disabled || !manages}
            onResolve={(confirm, payload) =>
              perform(() =>
                actions.resolveProposal(task.id, proposal.id, confirm, task.version, payload),
              )
            }
          />
        ))}
        {(detail.decisions ?? []).map((decision) => (
          <article className="artifact-item" key={decision.id}>
            <b>已确认决策 · 需求 v{decision.requirementsVersion}</b>
            <p>{decision.body}</p>
            <small>{name(decision.confirmedBy)} 确认</small>
          </article>
        ))}
        <details>
          <summary>添加提案</summary>
          <div className="collaboration-form">
            <label>
              提案类型
              <select
                disabled={disabled}
                value={proposalKind}
                onChange={(event) => {
                  setProposalKind(event.target.value as typeof proposalKind);
                  setProposalText('');
                }}
              >
                <option value="split">任务拆分提议</option>
                <option value="requirements">需求变更提议</option>
                <option value="decision">讨论决策提议</option>
              </select>
            </label>
            <label>
              {proposalKind === 'split'
                ? '子任务标题（每行一个；确认前可修改）'
                : proposalKind === 'requirements'
                  ? '提议的新需求全文'
                  : '提议的决策'}
              <textarea
                disabled={disabled}
                value={proposalText}
                onChange={(event) => setProposalText(event.target.value)}
              />
            </label>
            {proposalKind !== 'decision' && (
              <label>
                验收条件
                <textarea
                  disabled={disabled}
                  value={proposalAcceptance}
                  onChange={(event) => setProposalAcceptance(event.target.value)}
                />
              </label>
            )}
            {proposalKind === 'requirements' && (
              <label>
                影响说明
                <textarea
                  disabled={disabled}
                  value={impact}
                  onChange={(event) => setImpact(event.target.value)}
                />
              </label>
            )}
            <button
              className="button ghost"
              disabled={
                disabled ||
                !proposalText.trim() ||
                (proposalKind === 'requirements' && !impact.trim())
              }
              onClick={saveProposal}
            >
              提交提案，等待人类确认
            </button>
          </div>
        </details>
      </details>
      <details className="detail-section collaboration-section">
        <summary>
          <h3>领取与真实运行</h3>
          <span>{(detail.runs ?? []).length} 次运行</span>
        </summary>
        <p className="muted">领取只保留处理权，不表示进程已启动；运行事实由本机 runner 提供。</p>
        {(detail.claims ?? []).map((claim) => (
          <p key={claim.id}>
            {name(claim.actorId)} · {claim.releasedAt ? '已释放领取' : '已领取'} ·{' '}
            {new Date(claim.claimedAt).toLocaleString()}
          </p>
        ))}
        {(detail.runs ?? []).length === 0 && (
          <p className="muted">尚无真实运行记录。可通过本机 taskctl 运行命令启动受支持的 Agent。</p>
        )}
        {(detail.runs ?? []).map((run) => (
          <article className="artifact-item" key={run.id}>
            <b>
              {run.runner} · {run.phase}
            </b>
            <p>{run.failureReason}</p>
            {run.externalSessionId && <small>会话：{run.externalSessionId}</small>}
            {run.phase === 'unknown' && (
              <p className="workflow-warning">当前无法确认进程归属或状态；不代表已停止。</p>
            )}
          </article>
        ))}
      </details>
    </>
  );
}

function ParticipantEditor({
  participant,
  name,
  disabled,
  removable,
  onSave,
  onRemove,
}: {
  participant: TaskParticipant;
  name: string;
  disabled: boolean;
  removable: boolean;
  onSave: (value: TaskParticipant) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(participant);
  return (
    <details className="participant-item">
      <summary>
        <strong>{name}</strong>
        <span>
          {participant.progress}% · {participant.responsibility || '职责待填写'}
        </span>
      </summary>
      <div className="collaboration-form">
        <label>
          职责
          <input
            maxLength={2000}
            disabled={disabled}
            value={value.responsibility}
            onChange={(event) => setValue({ ...value, responsibility: event.target.value })}
          />
        </label>
        <label>
          进度（0—100）
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={value.progress}
            onChange={(event) =>
              setValue({
                ...value,
                progress: Math.min(100, Math.max(0, Number(event.target.value))),
              })
            }
          />
        </label>
        <label>
          成果与进展
          <textarea
            disabled={disabled}
            value={value.summary}
            onChange={(event) => setValue({ ...value, summary: event.target.value })}
          />
        </label>
        <label>
          阻塞原因
          <input
            disabled={disabled}
            value={value.blockedReason}
            onChange={(event) => setValue({ ...value, blockedReason: event.target.value })}
          />
        </label>
        <div className="exec-actions">
          <button className="button ghost" disabled={disabled} onClick={() => onSave(value)}>
            保存职责与进度
          </button>
          {removable && (
            <button className="text-button" disabled={disabled} onClick={onRemove}>
              移除参与者
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

function ProposalReview({
  proposal,
  description,
  acceptance,
  name,
  members,
  disabled,
  onResolve,
}: {
  proposal: TaskProposal;
  description: string;
  acceptance: string;
  name: (id: string | null) => string;
  members: Board['members'];
  disabled: boolean;
  onResolve: (confirm: boolean, payload?: unknown) => void;
}) {
  const [edited, setEdited] = useState(proposal);
  const confirmed = proposal.confirmedPayload
    ? proposalSchema.safeParse({ kind: proposal.kind, payload: proposal.confirmedPayload })
    : null;
  const display = proposal.state === 'confirmed' && confirmed?.success ? confirmed.data : edited;
  return (
    <article className="proposal-item">
      <b>
        {proposal.source === 'agent' ? 'AI 提议 · ' : '成员提议 · '}
        {proposal.kind === 'split'
          ? '任务拆分'
          : proposal.kind === 'requirements'
            ? '需求变更'
            : '讨论决策'}{' '}
        ·{' '}
        {proposal.state === 'proposed'
          ? '等待人类确认'
          : proposal.state === 'confirmed'
            ? '已确认'
            : '已拒绝'}
      </b>
      <small>
        提议者：{name(proposal.proposedBy)} · 基于需求 v{proposal.baseRequirementsVersion}
      </small>
      {display.kind === 'split' ? (
        <ol>
          {display.payload.children.map((child, index) => (
            <li key={index}>
              {proposal.state === 'proposed' && edited.kind === 'split' ? (
                <div className="collaboration-form">
                  <label>
                    子任务标题
                    <input
                      disabled={disabled}
                      value={child.title}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: {
                            children: edited.payload.children.map((item, i) =>
                              i === index ? { ...item, title: event.target.value } : item,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    说明
                    <textarea
                      disabled={disabled}
                      value={child.description}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: {
                            children: edited.payload.children.map((item, i) =>
                              i === index ? { ...item, description: event.target.value } : item,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    总负责人
                    <select
                      disabled={disabled}
                      value={child.assigneeId ?? ''}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: {
                            children: edited.payload.children.map((item, i) =>
                              i === index
                                ? { ...item, assigneeId: event.target.value || null }
                                : item,
                            ),
                          },
                        })
                      }
                    >
                      <option value="">未分配</option>
                      {members
                        .filter((member) => member.role !== 'viewer')
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    验收人
                    <select
                      disabled={disabled}
                      value={child.reviewerId ?? ''}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: {
                            children: edited.payload.children.map((item, i) =>
                              i === index
                                ? { ...item, reviewerId: event.target.value || null }
                                : item,
                            ),
                          },
                        })
                      }
                    >
                      <option value="">未分配</option>
                      {members
                        .filter((member) => member.role !== 'viewer')
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    验收条件
                    <textarea
                      disabled={disabled}
                      value={child.acceptanceCriteria}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: {
                            children: edited.payload.children.map((item, i) =>
                              i === index
                                ? { ...item, acceptanceCriteria: event.target.value }
                                : item,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="check-item">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={child.requiredForParent}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: {
                            children: edited.payload.children.map((item, i) =>
                              i === index
                                ? { ...item, requiredForParent: event.target.checked }
                                : item,
                            ),
                          },
                        })
                      }
                    />
                    必要子任务
                  </label>
                  <button
                    className="text-button"
                    disabled={disabled || edited.payload.children.length < 2}
                    onClick={() =>
                      setEdited({
                        ...edited,
                        payload: {
                          children: edited.payload.children.filter((_, i) => i !== index),
                        },
                      })
                    }
                  >
                    移除此拆分项
                  </button>
                </div>
              ) : (
                <>
                  <strong>{child.title}</strong>
                  <p>{child.description}</p>
                  <p>
                    负责人：{name(child.assigneeId)} · 验收人：{name(child.reviewerId)} ·{' '}
                    {child.requiredForParent ? '必要' : '非必要'}
                  </p>
                  <p>验收条件：{child.acceptanceCriteria || '待补充'}</p>
                </>
              )}
            </li>
          ))}
        </ol>
      ) : display.kind === 'requirements' ? (
        <>
          <div className="requirements-diff">
            <section>
              <h4>当前已确认内容</h4>
              <pre>{description}</pre>
              <p>{acceptance}</p>
            </section>
            <section>
              <h4>提议内容</h4>
              {proposal.state === 'proposed' && edited.kind === 'requirements' ? (
                <div className="collaboration-form">
                  <label>
                    新需求
                    <textarea
                      disabled={disabled}
                      value={edited.payload.description}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: { ...edited.payload, description: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    新验收条件
                    <textarea
                      disabled={disabled}
                      value={edited.payload.acceptanceCriteria}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: { ...edited.payload, acceptanceCriteria: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    影响说明
                    <textarea
                      disabled={disabled}
                      value={edited.payload.impact}
                      onChange={(event) =>
                        setEdited({
                          ...edited,
                          payload: { ...edited.payload, impact: event.target.value },
                        })
                      }
                    />
                  </label>
                </div>
              ) : (
                <>
                  <pre>{display.payload.description}</pre>
                  <p>{display.payload.acceptanceCriteria}</p>
                </>
              )}
            </section>
          </div>
          <p>
            <strong>影响：</strong>
            {display.payload.impact}
          </p>
        </>
      ) : (
        <p>{display.payload.body}</p>
      )}
      {proposal.confirmedBy && <p>{name(proposal.confirmedBy)} 已确认</p>}
      {proposal.state === 'proposed' && (
        <div className="exec-actions">
          <button
            className="button primary"
            disabled={disabled}
            onClick={() => onResolve(true, edited.payload)}
          >
            确认并应用调整
          </button>
          <button className="button ghost" disabled={disabled} onClick={() => onResolve(false)}>
            拒绝提案
          </button>
        </div>
      )}
    </article>
  );
}
