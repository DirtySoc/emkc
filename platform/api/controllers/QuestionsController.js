const fs = require('fs');
const q = require('q');

module.exports = {

    view(req, res) {
        var question_id = req.params.question_id;
        var name = req.params.name;

        return db.questions
            .find_one({
                where: {
                    question_id
                }
            })
            .then(question => {
                if (!question) throw new Error('Question not found');

                if (question.slug !== name) {
                    res.redirect(question.url);
                    throw null;
                }

                return db.sequelize
                    .query(
                        require('fs')
                            .read_file_sync(root_dir + '/platform/var/sql/temp.sql')
                            .toString()
                            .replace('__question_id__', question_id)
                            .replace('__limit__', 10)
                        );
            })
            .spread(rows => {
                var comments = [];

                // add base comments
                var comment_id = null;

                rows.for_each(row => {
                    if (row.c1_comment_id === comment_id) return null;

                    comment_id = row.c1_comment_id;

                    comments.push({
                        depth: 0,
                        comment_id: row.c1_comment_id,
                        comment: row.c1_comment,
                        score: row.c1_score,
                        created_at: row.c1_created_at,
                        time_ago: util.time_ago(row.c1_created_at),
                        username: row.c1_username,
                        comments: []
                    });
                });

                // add nested comments recursively to base comments
                var process_comments = (comments, depth) => {
                    comments.for_each(comment => {
                        comment.comments = rows
                            .filter(row => {
                                if (depth === 1)
                                    return row.c2_depth === depth && comment.comment_id === row.c2_base_id
                                return row.c2_depth === depth && comment.comment_id === row.c2_parent_id
                            })
                            .map(row => {
                                return {
                                    depth: row.c2_depth,
                                    comment_id: row.c2_comment_id,
                                    parent_id: row.c2_parent_id,
                                    comment: row.c2_comment,
                                    score: row.c2_score,
                                    created_at: row.c2_created_at,
                                    time_ago: util.time_ago(row.c2_created_at),
                                    username: row.c2_username,
                                    comments: []
                                }
                            });

                        if (comment.comments.length > 0) {
                            process_comments(comment.comments, depth + 1);
                        }
                    });
                };

                process_comments(comments, 1);

                return res.view({
                    comments: JSON.stringify(comments)
                });
            })
            .catch(err => {
                if (err)
                    return res.redirect('/board');
            });
    },

    _config: {}

};
